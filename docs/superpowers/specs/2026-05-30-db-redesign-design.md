# DB設計再構築 仕様書

**日付:** 2026-05-30  
**対象:** `investment-app` — Next.js 16 投資管理アプリ  
**目的:** データ重複の解消と価格の自動連動。`Holding` と `Stock` に関係を持たせ、データの一貫性を確保する。

---

## 背景と課題

現状のスキーマには以下の問題がある。

- `Holding` と `Stock` が完全に独立しており、`name`・`ticker`・`sector`・`per`・`pbr`・`dividendYield`・`marketCap` が両テーブルに重複している
- `Holding.currentPrice` は手動入力値のままで、`Stock.currentPrice`（Yahoo Finance 同期値）と連動していない
- `SyncJob.status` が String 型で型安全でない
- `SyncJob` は件数が蓄積し続けるが、実際に参照するのは最新1件のみ

---

## 前提条件

- `Holding` は必ず `Stock` テーブルに存在する銘柄しか登録しない（外部キー必須）
- 同一銘柄に複数ロット（異なる購入日・購入単価）を登録できる
- `SyncJob` は最新1件のみ保持（固定ID `"singleton"` で upsert）

---

## 新しいPrismaスキーマ

```prisma
enum SyncStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}

model Stock {
  id            String    @id @default(cuid())
  ticker        String    @unique
  name          String
  sector        String?
  market        String?
  currentPrice  Float?
  per           Float?
  pbr           Float?
  dividendYield Float?
  marketCap     Float?
  eps           Float?
  roe           Float?
  lastUpdated   DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  holdings      Holding[]
}

model Holding {
  id            String    @id @default(cuid())
  stockId       String
  stock         Stock     @relation(fields: [stockId], references: [id])
  quantity      Float
  purchasePrice Float
  purchaseDate  DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model SyncJob {
  id          String     @id  // 値は必ず "singleton" を使う。@default は使わず upsert で強制する
  status      SyncStatus @default(PENDING)
  total       Int        @default(0)
  processed   Int        @default(0)
  failed      Int        @default(0)
  startedAt   DateTime   @default(now())
  completedAt DateTime?
}
```

### Holding から削除するカラム

`name`, `ticker`, `sector`, `currentPrice`, `per`, `pbr`, `dividendYield`, `marketCap`

### Holding に追加するカラム

| カラム | 型 | 説明 |
|--------|-----|------|
| `stockId` | String | Stock への外部キー（必須） |
| `purchaseDate` | DateTime? | 購入日（任意） |

---

## APIの変更

### `GET /api/holdings`

`Stock` を JOIN してフロントエンドの `Holding` 型にフラット化して返す。フロントエンド側の変更を最小化する。

```ts
const rows = await prisma.holding.findMany({
  include: { stock: true },
  where: {
    AND: [
      q ? { OR: [{ stock: { name: { contains: q, mode: "insensitive" } } },
                 { stock: { ticker: { contains: q, mode: "insensitive" } } }] } : {},
      sector ? { stock: { sector } } : {},
    ],
  },
  orderBy: { createdAt: "desc" },
});

return rows.map((h) => ({
  id: h.id,
  stockId: h.stockId,
  name: h.stock.name,
  ticker: h.stock.ticker,
  sector: h.stock.sector ?? "",
  quantity: h.quantity,
  purchasePrice: h.purchasePrice,
  purchaseDate: h.purchaseDate?.toISOString() ?? null,
  currentPrice: h.stock.currentPrice ?? 0,
  per: h.stock.per ?? null,
  pbr: h.stock.pbr ?? null,
  dividendYield: h.stock.dividendYield ?? null,
  marketCap: h.stock.marketCap ?? null,
}));
```

### `POST /api/holdings`

リクエストボディ: `{ stockId, quantity, purchasePrice, purchaseDate? }`

Stock が存在しない stockId の場合は 404 を返す。

### `PUT /api/holdings/:id`

更新可能フィールド: `quantity`, `purchasePrice`, `purchaseDate` のみ。

`stockId` の変更は受け付けない（銘柄変更は削除→再登録）。

### `SyncJob` の upsert

```ts
await prisma.syncJob.upsert({
  where: { id: "singleton" },
  create: { id: "singleton", status: "RUNNING", total, startedAt: new Date() },
  update: { status: "RUNNING", processed: 0, failed: 0, startedAt: new Date(), completedAt: null },
});
```

---

## フロントエンドの変更範囲

### `src/types/index.ts`

`Holding` インターフェースに以下を追加：

```ts
export interface Holding {
  id: string;
  stockId: string;           // ← 追加
  name: string;
  ticker: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate?: string | null; // ← 追加
  currentPrice: number;
  sector: string;
  per?: number | null;
  pbr?: number | null;
  dividendYield?: number | null;
  marketCap?: number | null;
}
```

### `HoldingModal`

- 銘柄選択で `stockId` を決定する（ticker 検索 → Stock を選択）
- 入力フィールド: `quantity`、`purchasePrice`、`purchaseDate`
- `name`、`ticker`、`sector`、`per`、`pbr`、`dividendYield`、`marketCap` のフォーム入力を廃止（Stock側で管理）
- 保存時のボディ: `{ stockId, quantity, purchasePrice, purchaseDate }`

### 変更不要なコンポーネント

`PortfolioTable`、`ProfitLossCard`、`PortfolioChart`、`AIAdviceChat`、`StockScreening` — APIレスポンスの形が同じため変更不要。

---

## マイグレーション戦略

### ステップ1: 中間マイグレーション（nullable で stockId 追加）

`stockId String?` として追加。旧カラムはまだ残す。

### ステップ2: データ移行スクリプト実行

```ts
// scripts/migrate-holdings.ts
const holdings = await prisma.holding.findMany();
for (const h of holdings) {
  const stock = await prisma.stock.upsert({
    where: { ticker: h.ticker },
    create: {
      ticker: h.ticker,
      name: h.name,
      sector: h.sector || null,
      currentPrice: h.currentPrice,
    },
    update: {},
  });
  await prisma.holding.update({
    where: { id: h.id },
    data: { stockId: stock.id },
  });
}
```

### ステップ3: 最終マイグレーション

- `stockId` を NOT NULL に変更
- 旧カラム（`name`, `ticker`, `sector`, `currentPrice`, `per`, `pbr`, `dividendYield`, `marketCap`）を削除
- `SyncJob.status` を String → `SyncStatus` enum に変更
- `SyncJob.id` の `@default` を `"singleton"` に変更

### リスク

- 既存 `Holding.ticker` が `Stock` テーブルに存在しない場合、移行スクリプトが Stock を新規作成する（`currentPrice` のみ設定、指標は null）
- 移行後は `Stock` 同期（Yahoo Finance）を実行して指標を補完することを推奨

---

## 成功基準

- `Holding` テーブルから株式情報カラムが完全に消える
- `currentPrice` が常に `Stock.currentPrice` から取得される
- `SyncJob` が常に1件（`id = "singleton"`）に保たれる
- `SyncStatus` enum で型安全になる
- 既存の全機能（CRUD・チャート・スクリーニング・AI）が動作し続ける
- `npx tsc --noEmit` がエラー0件
