# 東証全銘柄自動取得 仕様書

**日付:** 2026-05-30  
**対象:** `investment-app` — Next.js 16 投資管理アプリ  
**目的:** J-Quants API と JPX 信用残CSV を使い、サーバー起動時に東証全銘柄（約3,800銘柄）の株価・財務データ・信用倍率を自動でDBに格納する。Yahoo Finance への依存を排除し、数分以内に全データ取得を完了させる。

---

## 背景と課題

| 現状 | 問題 |
|------|------|
| 銘柄登録: 日経225ハードコード or JPX CSV手動アップロード | ユーザー操作が必要、225銘柄のみ |
| 株価同期: Yahoo Finance（1銘柄 × 3秒） | 3,800銘柄で約3時間かかる |
| 信用倍率: 未実装 | スクリーニング指標が不足 |

---

## データソースと役割

| ソース | 取得データ | 更新方式 |
|--------|----------|---------|
| J-Quants API `/v1/listed/info` | 全銘柄名・市場・業種 | 起動時 |
| J-Quants API `/v1/prices/daily_quotes` | 前日終値・時価総額 | 起動時 |
| J-Quants API `/v1/fins/statements` | EPS・純資産/株（PER = 株価÷EPS、PBR = 株価÷純資産/株で計算） | 起動時 |
| J-Quants API `/v1/fins/dividend` | 一株配当（配当利回り計算用） | 起動時 |
| JPX 信用残CSV | 信用倍率（信用買残 ÷ 信用売残） | 起動時 |

**Yahoo Finance は使用しない。**

---

## DB スキーマ変更

### Stock モデル

```prisma
model Stock {
  id             String    @id @default(cuid())
  ticker         String    @unique  // 変更: "7203.T" → "7203"（4桁コード）
  name           String
  sector         String?
  market         String?
  currentPrice   Float?
  per            Float?
  pbr            Float?
  dividendYield  Float?
  marketCap      Float?
  eps            Float?
  roe            Float?
  shinyoBairitsu Float?             // 新規追加: 信用倍率
  lastUpdated    DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  holdings       Holding[]
}
```

### 変更内容
1. `shinyoBairitsu Float?` を追加
2. `ticker` の値形式を `7203.T` → `7203` に変更（DB上のユニーク制約はそのまま）

### マイグレーション戦略
- 既存データが0件の場合: 通常の `prisma migrate dev` で完了
- 既存データがある場合: 3ステップ（Step 1: カラム追加 → Step 2: ticker正規化SQL → Step 3: 完了）

### ticker コード変換ルール

| ソース | 形式 | 変換 | DB格納値 |
|--------|------|------|---------|
| J-Quants | `72030`（5桁） | 末尾の `0` を除去 | `7203` |
| JPX 信用残CSV | `7203`（4桁） | そのまま | `7203` |
| 旧DB値 | `7203.T` | `.T` を除去 | `7203` |

`Holding.stockId` は `Stock.id`（CUID）への外部キーのため、ticker変更の影響なし。

---

## 環境変数

`.env.local` に追加：

```env
JQUANTS_EMAIL=your@email.com
JQUANTS_PASSWORD=yourpassword
```

J-Quantsの無料アカウントは https://jpx-jquants.com/ で登録。

---

## J-Quants API 認証フロー

```
POST https://api.jpx-jquants.com/v1/token/auth_user
  body: { mailaddress, password }
  → { refreshToken }  (有効期限: 1週間)

POST https://api.jpx-jquants.com/v1/token/auth_refresh
  body: { refreshtoken }
  → { idToken }  (有効期限: 24時間)

以降のリクエスト: Authorization: Bearer {idToken}
```

---

## 新規ファイル: `src/services/jquantsApi.ts`

責務: J-Quants認証 + 各エンドポイント呼び出し

```typescript
// エクスポートする関数
export async function getJQuantsIdToken(): Promise<string>
export async function fetchListedInfo(): Promise<JQuantsStock[]>
export async function fetchDailyQuotes(date: string): Promise<JQuantsQuote[]>
export async function fetchFinStatements(): Promise<JQuantsStatement[]>
export async function fetchDividend(): Promise<JQuantsDividend[]>
```

### 型定義

```typescript
interface JQuantsStock {
  Code: string;        // "72030"
  CompanyName: string;
  Sector33CodeName: string;
  MarketCodeName: string;
}

interface JQuantsQuote {
  Code: string;        // "72030"
  Close: number;       // 前日終値
  MarketCapitalization: number; // 時価総額
}

interface JQuantsStatement {
  Code: string;        // "72030"
  EarningsPerShare: number;
  BookValuePerShare: number;
}

interface JQuantsDividend {
  Code: string;        // "72030"
  DividendPayableDate: string;
  DividendPerShare: number;
}
```

---

## JPX 信用残CSV 取得

### ソース
JPX 毎週木曜公開。一覧ページから最新URLを取得してCSVをダウンロード。

```
一覧: https://www.jpx.co.jp/markets/statistics-equities/margin/index.html
CSVリンクパターン: *.csv
文字コード: Shift-JIS → iconv-liteで UTF-8 変換
```

### CSV フォーマット（主要カラム）

```
コード | 銘柄名 | 信用買残（株） | 信用売残（株） | 信用倍率
7203   | トヨタ  | 1234567       | 456789        | 2.70
```

### 計算式
```
信用倍率 = 信用買残（株） ÷ 信用売残（株）
```

信用売残が0の場合は `null`（ゼロ除算回避）。

### 新規ファイル: `src/services/jpxMarginApi.ts`

```typescript
export async function fetchShinyoBairitsu(): Promise<Map<string, number>>
// 戻り値: Map<"7203", 2.70>
```

---

## `src/instrumentation.ts` 起動フロー

```typescript
export async function register() {
  // Edge Runtimeでは実行しない
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // 環境変数未設定時はスキップ
  if (!process.env.JQUANTS_EMAIL) return;

  try {
    // Step 1: J-Quants: 銘柄リスト取得・upsert（全銘柄, 数秒）
    const listedInfo = await fetchListedInfo();
    await upsertStocks(listedInfo);

    // Step 2: J-Quants: 前日株価・時価総額更新（数十秒）
    // 当日が営業日なら当日、土日祝なら直前営業日の日付文字列（YYYY-MM-DD）を渡す
    const quotes = await fetchDailyQuotes(getPreviousTradingDate());
    await updatePrices(quotes);

    // Step 3: J-Quants: 財務データ更新（EPS, 純資産/株 → PER/PBR計算）
    const statements = await fetchFinStatements();
    await updateFinancials(statements);

    // Step 4: J-Quants: 配当利回り更新
    const dividends = await fetchDividend();
    await updateDividends(dividends);

    // Step 5: JPX: 信用倍率更新
    const margin = await fetchShinyoBairitsu();
    await updateMargin(margin);

  } catch (e) {
    // エラーは握り潰してサーバー起動を止めない
    console.error("[startup] stock data initialization failed:", e);
  }
}
```

**総所要時間の見込み:** 約1〜3分（全3,800銘柄）

---

## API ルート変更

### 削除するルート
| ルート | 理由 |
|--------|------|
| `POST /api/stocks/seed` | J-Quantsの `listed/info` が代替 |
| `POST /api/stocks/import` | J-Quantsの `listed/info` が代替 |
| `POST /api/stocks/sync` | J-Quantsが代替 |
| `GET /api/stocks/sync` | 同上 |

### `GET /api/stocks` (スクリーニング用)
変更なし。`ticker` カラムの値が `7203` になるだけ。

---

## フロントエンド変更

### `src/features/screening/components/StockScreening.tsx`
削除するUI要素：
- 「日経225を登録する」ボタン
- 「JPX CSVを取り込む」ボタン
- `useStockSync` の `seed`, `importCsv` 関連コード
- セットアップガイドセクション全体

追加するUIカラム（結果テーブル）：
- 「信用倍率」列（`shinyoBairitsu` の値）

### `src/hooks/useAutoSync.ts`
- `syncStocks` と `getSyncCount` の呼び出しを削除
- 起動時同期はバックエンド（instrumentation.ts）が担当するため、フロントエンドの自動同期は不要
- ヘッダーの同期ステータス表示を削除（または「データ読み込み済み」表示に変更）

### `src/features/screening/hooks/useStockSync.ts`
- `seed`, `importCsv` 関連のロジックを削除
- または `useStockSync` フック自体を削除

---

## 信用倍率のスクリーニング条件追加

`useScreening.ts` と `GET /api/stocks` ルートに `shinyoBairitsuMax` フィルターを追加。

---

## 成功基準

- サーバー起動後3分以内に全銘柄の株価がDBに格納される
- スクリーニング結果に「信用倍率」カラムが表示される
- 「日経225登録」「JPX CSV取込」ボタンが削除される
- Yahoo Finance 関連コードが残存しない
- `npx tsc --noEmit` がエラー0件
- J-Quants 認証情報が未設定の場合、起動を止めずにスキップされる
