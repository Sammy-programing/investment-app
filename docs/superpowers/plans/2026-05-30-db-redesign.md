# DB Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `Holding` を純粋なロットレコードとし `Stock` へ外部キーで参照することで、データ重複を解消して `currentPrice` を常に `Stock` から取得できるようにする。

**Architecture:** 2フェーズ Prisma マイグレーション（既存データ保護）→ データ移行スクリプト → API・フロントエンド更新の順で進める。各ステップでアプリが動作する状態を維持する。

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 7 + PostgreSQL (PrismaPg driver adapter), `tsx` (スクリプト実行)

---

## ファイルマップ

| 操作 | パス |
|------|------|
| 更新 | `prisma/schema.prisma`（2回） |
| 作成 | `scripts/migrate-holdings.ts` |
| 更新 | `src/types/index.ts` |
| 更新 | `src/services/holdingsApi.ts` |
| 更新 | `src/features/portfolio/hooks/useHoldings.ts` |
| 更新 | `src/app/api/holdings/route.ts` |
| 更新 | `src/app/api/holdings/[id]/route.ts` |
| 更新 | `src/app/api/stocks/sync/route.ts` |
| 更新 | `src/features/portfolio/components/HoldingModal.tsx` |

**変更しないもの:** `PortfolioTable`、`ProfitLossCard`、`PortfolioChart`、`AIAdviceChat`、`StockScreening`、全 Stock 関連 API ルート

---

## Task 1: Phase 1 Prisma マイグレーション（中間状態）

既存データを壊さずに `stockId`（nullable）と `purchaseDate` を `Holding` に追加し、`Stock` に逆参照を追加する。

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: schema.prisma を Phase 1 状態に書き換える**

`prisma/schema.prisma` の全内容を以下に置き換える：

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
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
  name          String
  ticker        String
  quantity      Float
  purchasePrice Float
  currentPrice  Float
  sector        String
  per           Float?
  pbr           Float?
  dividendYield Float?
  marketCap     Float?
  stockId       String?
  stock         Stock?    @relation(fields: [stockId], references: [id])
  purchaseDate  DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model SyncJob {
  id          String    @id @default(cuid())
  status      String    @default("pending")
  total       Int       @default(0)
  processed   Int       @default(0)
  failed      Int       @default(0)
  startedAt   DateTime  @default(now())
  completedAt DateTime?
}
```

- [ ] **Step 2: マイグレーションを実行する**

```bash
cd investment-app
npx prisma migrate dev --name add_holding_stock_relation
```

Expected: `The following migration(s) have been applied:` が表示され、`prisma/migrations/` に新ファイルが作成される。

- [ ] **Step 3: Prisma Client を再生成する**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client` が表示される。

- [ ] **Step 4: TypeScript チェック**

```bash
npx tsc --noEmit
```

Expected: エラー0件（無出力）。

- [ ] **Step 5: コミット**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: phase1 migration - add nullable stockId and purchaseDate to Holding"
```

---

## Task 2: データ移行スクリプトの作成と実行

既存の `Holding` レコードに `stockId` を付与し、`SyncJob` を全削除する。

**Files:**
- Create: `scripts/migrate-holdings.ts`

- [ ] **Step 1: スクリプトを作成する**

```typescript
// scripts/migrate-holdings.ts
import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

dotenv.config({ path: ".env.local" });

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

  const holdings = await prisma.holding.findMany();
  console.log(`Processing ${holdings.length} holdings...`);

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
    console.log(`  Linked ${h.ticker} (holding ${h.id}) → stock ${stock.id}`);
  }

  const deleted = await prisma.syncJob.deleteMany();
  console.log(`Deleted ${deleted.count} SyncJob record(s).`);

  await prisma.$disconnect();
  console.log("Migration complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: スクリプトを実行する**

```bash
npx tsx scripts/migrate-holdings.ts
```

Expected:
```
Processing N holdings...
  Linked XXXX (holding ...) → stock ...
Deleted N SyncJob record(s).
Migration complete.
```

保有銘柄が0件の場合は `Processing 0 holdings...` → `Deleted 0 SyncJob record(s).` → `Migration complete.` で正常。

- [ ] **Step 3: コミット**

```bash
git add scripts/migrate-holdings.ts
git commit -m "feat: data migration script for holding-stock relation"
```

---

## Task 3: Phase 2 Prisma マイグレーション（最終状態）

`Holding` から旧カラムを削除し、`SyncStatus` enum を追加して `SyncJob` を更新する。

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: schema.prisma を最終状態に書き換える**

`prisma/schema.prisma` の全内容を以下に置き換える：

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

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
  id          String     @id
  status      SyncStatus @default(PENDING)
  total       Int        @default(0)
  processed   Int        @default(0)
  failed      Int        @default(0)
  startedAt   DateTime   @default(now())
  completedAt DateTime?
}
```

- [ ] **Step 2: マイグレーションを実行する**

```bash
npx prisma migrate dev --name finalize_holding_stock_relation
```

Expected: マイグレーション適用完了のメッセージ。`Holding` の旧カラムが削除され、`SyncStatus` enum が追加される。

- [ ] **Step 3: Prisma Client を再生成する**

```bash
npx prisma generate
```

- [ ] **Step 4: TypeScript チェック（型エラーが大量に出ることを確認する）**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: `Holding` の `name`、`ticker` 等を参照している箇所でエラーが出る。これは正常。Task 4〜9 で修正する。

- [ ] **Step 5: コミット**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: phase2 migration - finalize Holding schema, add SyncStatus enum"
```

---

## Task 4: types/index.ts を更新する

`Holding` に `stockId` と `purchaseDate` を追加し、`HoldingSaveInput` 型を追加する。

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: types/index.ts を書き換える**

```typescript
export interface Holding {
  id: string;
  stockId: string;
  name: string;
  ticker: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate?: string | null;
  currentPrice: number;
  sector: string;
  per?: number | null;
  pbr?: number | null;
  dividendYield?: number | null;
  marketCap?: number | null;
}

export interface HoldingSaveInput {
  id?: string;
  stockId: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate?: string | null;
}

export interface PortfolioStats {
  totalValue: number;
  totalCost: number;
  totalProfitLoss: number;
  totalProfitLossPercent: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StockSearchResult {
  ticker: string;
  name: string;
  exchange: string;
}

export interface Stock {
  id: string;
  ticker: string;
  name: string;
  sector?: string | null;
  market?: string | null;
  currentPrice?: number | null;
  per?: number | null;
  pbr?: number | null;
  dividendYield?: number | null;
  marketCap?: number | null;
  eps?: number | null;
  roe?: number | null;
  lastUpdated?: string | null;
}

export interface ScreeningCriteria {
  sector: string;
  perMax: string;
  pbrMax: string;
  dyMin: string;
  plMin: string;
  plMax: string;
}
```

- [ ] **Step 2: TypeScript チェック**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: まだエラーが残る（holdingsApi、APIルート等がまだ旧型を使っているため）。

- [ ] **Step 3: コミット**

```bash
git add src/types/index.ts
git commit -m "feat: update Holding type - add stockId, purchaseDate, HoldingSaveInput"
```

---

## Task 5: holdingsApi.ts と useHoldings.ts を更新する

`createHolding`・`updateHolding` の型を `HoldingSaveInput` に合わせ、`useHoldings.save` を更新する。

**Files:**
- Modify: `src/services/holdingsApi.ts`
- Modify: `src/features/portfolio/hooks/useHoldings.ts`

- [ ] **Step 1: holdingsApi.ts を書き換える**

```typescript
// src/services/holdingsApi.ts
import { Holding, HoldingSaveInput } from "@/types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`API error: ${res.status} ${url}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function fetchHoldings(q?: string, sector?: string): Promise<Holding[]> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (sector) params.set("sector", sector);
  return request<Holding[]>(`/api/holdings?${params}`);
}

export async function createHolding(data: Omit<HoldingSaveInput, "id">): Promise<Holding> {
  return request<Holding>("/api/holdings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      stockId: data.stockId,
      quantity: data.quantity,
      purchasePrice: data.purchasePrice,
      purchaseDate: data.purchaseDate ?? null,
    }),
  });
}

export async function updateHolding(
  id: string,
  data: Pick<HoldingSaveInput, "quantity" | "purchasePrice" | "purchaseDate">
): Promise<Holding> {
  return request<Holding>(`/api/holdings/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quantity: data.quantity,
      purchasePrice: data.purchasePrice,
      purchaseDate: data.purchaseDate ?? null,
    }),
  });
}

export async function deleteHolding(id: string): Promise<void> {
  await request<void>(`/api/holdings/${id}`, { method: "DELETE" });
}
```

- [ ] **Step 2: useHoldings.ts の save 関数を更新する**

`src/features/portfolio/hooks/useHoldings.ts` の `save` 関数のシグネチャを `HoldingSaveInput` に変更する：

```typescript
// src/features/portfolio/hooks/useHoldings.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { Holding, HoldingSaveInput } from "@/types";
import { fetchHoldings, createHolding, updateHolding, deleteHolding } from "@/services/holdingsApi";

export function useHoldings() {
  const [allHoldings, setAllHoldings] = useState<Holding[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");
  const mountedRef = useRef(false);

  const load = useCallback(async (q = searchQuery, sector = sectorFilter) => {
    const data = await fetchHoldings(q, sector);
    setHoldings(data);
    if (!q && !sector) setAllHoldings(data);
    setLoading(false);
  }, [searchQuery, sectorFilter]);

  const loadAll = useCallback(async () => {
    const data = await fetchHoldings();
    setAllHoldings(data);
  }, []);

  useEffect(() => {
    load();
    loadAll();
    mountedRef.current = true;
  }, []);

  useEffect(() => {
    if (!mountedRef.current) return;
    const t = setTimeout(() => load(searchQuery, sectorFilter), 300);
    return () => clearTimeout(t);
  }, [searchQuery, sectorFilter, load]);

  const save = useCallback(async (data: HoldingSaveInput) => {
    if (data.id) {
      await updateHolding(data.id, {
        quantity: data.quantity,
        purchasePrice: data.purchasePrice,
        purchaseDate: data.purchaseDate,
      });
    } else {
      await createHolding({
        stockId: data.stockId,
        quantity: data.quantity,
        purchasePrice: data.purchasePrice,
        purchaseDate: data.purchaseDate,
      });
    }
    load();
    loadAll();
  }, [load, loadAll]);

  const remove = useCallback(async (id: string) => {
    await deleteHolding(id);
    load();
    loadAll();
  }, [load, loadAll]);

  return {
    holdings,
    allHoldings,
    loading,
    searchQuery,
    setSearchQuery,
    sectorFilter,
    setSectorFilter,
    save,
    remove,
  };
}
```

- [ ] **Step 3: TypeScript チェック**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: holdingsApi・useHoldings 関連のエラーが消える。API ルートと HoldingModal のエラーがまだ残る。

- [ ] **Step 4: コミット**

```bash
git add src/services/holdingsApi.ts src/features/portfolio/hooks/useHoldings.ts
git commit -m "feat: update holdingsApi and useHoldings for new Holding schema"
```

---

## Task 6: GET / POST /api/holdings を更新する

Stock を JOIN してフラット化して返す。POST は `stockId` ベースに変更する。

**Files:**
- Modify: `src/app/api/holdings/route.ts`

- [ ] **Step 1: route.ts を書き換える**

```typescript
// src/app/api/holdings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function flattenHolding(h: {
  id: string;
  stockId: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate: Date | null;
  stock: {
    name: string;
    ticker: string;
    sector: string | null;
    currentPrice: number | null;
    per: number | null;
    pbr: number | null;
    dividendYield: number | null;
    marketCap: number | null;
  };
}) {
  return {
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
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const sector = searchParams.get("sector") ?? "";

  const holdings = await prisma.holding.findMany({
    include: { stock: true },
    where: {
      AND: [
        q
          ? {
              OR: [
                { stock: { name: { contains: q, mode: "insensitive" } } },
                { stock: { ticker: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {},
        sector ? { stock: { sector } } : {},
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(holdings.map(flattenHolding));
}

export async function POST(req: NextRequest) {
  const { stockId, quantity, purchasePrice, purchaseDate } = await req.json();

  const stockExists = await prisma.stock.findUnique({ where: { id: stockId } });
  if (!stockExists) {
    return NextResponse.json({ error: "Stock not found" }, { status: 404 });
  }

  const holding = await prisma.holding.create({
    data: {
      stockId,
      quantity,
      purchasePrice,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
    },
    include: { stock: true },
  });

  return NextResponse.json(flattenHolding(holding), { status: 201 });
}
```

- [ ] **Step 2: TypeScript チェック**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: コミット**

```bash
git add src/app/api/holdings/route.ts
git commit -m "feat: update GET/POST /api/holdings to use Stock relation"
```

---

## Task 7: PUT / DELETE /api/holdings/[id] を更新する

PUT は `quantity`・`purchasePrice`・`purchaseDate` のみ受け付ける。

**Files:**
- Modify: `src/app/api/holdings/[id]/route.ts`

- [ ] **Step 1: route.ts を書き換える**

```typescript
// src/app/api/holdings/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { quantity, purchasePrice, purchaseDate } = await req.json();

  const holding = await prisma.holding.update({
    where: { id },
    data: {
      quantity,
      purchasePrice,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
    },
    include: { stock: true },
  });

  return NextResponse.json({
    id: holding.id,
    stockId: holding.stockId,
    name: holding.stock.name,
    ticker: holding.stock.ticker,
    sector: holding.stock.sector ?? "",
    quantity: holding.quantity,
    purchasePrice: holding.purchasePrice,
    purchaseDate: holding.purchaseDate?.toISOString() ?? null,
    currentPrice: holding.stock.currentPrice ?? 0,
    per: holding.stock.per ?? null,
    pbr: holding.stock.pbr ?? null,
    dividendYield: holding.stock.dividendYield ?? null,
    marketCap: holding.stock.marketCap ?? null,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.holding.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: TypeScript チェック**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: コミット**

```bash
git add src/app/api/holdings/[id]/route.ts
git commit -m "feat: update PUT/DELETE /api/holdings/:id for new schema"
```

---

## Task 8: sync route を SyncStatus enum とシングルトンに更新する

`SyncJob` の create → upsert（id="singleton"）、String ステータス → `SyncStatus` enum に変更する。

**Files:**
- Modify: `src/app/api/stocks/sync/route.ts`

- [ ] **Step 1: route.ts を書き換える**

```typescript
// src/app/api/stocks/sync/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SyncStatus } from "@prisma/client";

const BATCH_SIZE = 10;
const INTERVAL_MS = 3000;
const RETRY_DELAYS_MS = [10_000, 20_000, 30_000];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const pendingWhere = (cutoff: Date) => ({
  OR: [
    { lastUpdated: null },
    { lastUpdated: { lt: cutoff } },
  ],
});

export async function GET() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const total = await prisma.stock.count({ where: pendingWhere(cutoff) });
  return NextResponse.json({ total });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const jobId: string | undefined = body.jobId;

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const targets = await prisma.stock.findMany({
    where: pendingWhere(cutoff),
    take: BATCH_SIZE,
    orderBy: { lastUpdated: "asc" },
    select: { id: true, ticker: true },
  });

  const remaining = await prisma.stock.count({ where: pendingWhere(cutoff) });

  if (targets.length === 0) {
    await prisma.syncJob.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", status: SyncStatus.COMPLETED, total: 0, completedAt: new Date() },
      update: { status: SyncStatus.COMPLETED, completedAt: new Date() },
    });
    return NextResponse.json({ done: true, remaining: 0, processed: 0, total: 0, failed: 0, jobId: "singleton" });
  }

  const total = await prisma.stock.count();
  const job = await prisma.syncJob.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", status: SyncStatus.RUNNING, total, processed: 0, failed: 0, startedAt: new Date() },
    update: {
      status: SyncStatus.RUNNING,
      completedAt: null,
      // 新規同期開始時（jobId未設定）はカウンターをリセット
      ...(jobId ? {} : { total, startedAt: new Date(), processed: 0, failed: 0 }),
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const yahooFinance = (await import("yahoo-finance2")).default as any;
  let processed = 0;
  let failed = 0;

  for (const stock of targets) {
    let success = false;
    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length + 1; attempt++) {
      try {
        const quote = await yahooFinance.quote(stock.ticker);
        await prisma.stock.update({
          where: { id: stock.id },
          data: {
            currentPrice: quote.regularMarketPrice ?? null,
            per: quote.trailingPE ?? null,
            pbr: quote.priceToBook ?? null,
            dividendYield: quote.dividendYield ? quote.dividendYield * 100 : null,
            marketCap: quote.marketCap ?? null,
            eps: quote.epsTrailingTwelveMonths ?? null,
            lastUpdated: new Date(),
          },
        });
        success = true;
        break;
      } catch {
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]);
        }
      }
    }
    if (!success) failed++;
    await sleep(INTERVAL_MS);
  }

  const totalProcessed = job.processed + processed;
  const totalFailed = job.failed + failed;
  const newRemaining = remaining - targets.length;

  await prisma.syncJob.update({
    where: { id: "singleton" },
    data: {
      processed: totalProcessed,
      failed: totalFailed,
      status: newRemaining <= 0 ? SyncStatus.COMPLETED : SyncStatus.RUNNING,
      completedAt: newRemaining <= 0 ? new Date() : null,
    },
  });

  return NextResponse.json({
    done: newRemaining <= 0,
    remaining: Math.max(0, newRemaining),
    processed: totalProcessed,
    failed: totalFailed,
    total: job.total,
    jobId: "singleton",
  });
}
```

- [ ] **Step 2: useStockSync.ts の jobId 参照を "singleton" に合わせる**

`src/features/screening/hooks/useStockSync.ts` を確認する。`start()` 関数内で `data.jobId` をローカル変数 `jobId` に保存しているが、サーバーは常に `"singleton"` を返すようになった。ロジックの変更は不要（クライアントが jobId を送っても送らなくても、サーバーは singleton を使う）。

- [ ] **Step 3: TypeScript チェック**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: sync route のエラーが消える。HoldingModal のエラーがまだ残る可能性がある。

- [ ] **Step 4: コミット**

```bash
git add src/app/api/stocks/sync/route.ts
git commit -m "feat: update sync route to use SyncStatus enum and singleton SyncJob"
```

---

## Task 9: HoldingModal を stockId ベースのフォームに更新する

銘柄をローカル `Stock` テーブルから検索して `stockId` を決定する。`quantity`・`purchasePrice`・`purchaseDate` のみ入力する。

**Files:**
- Modify: `src/features/portfolio/components/HoldingModal.tsx`

- [ ] **Step 1: HoldingModal.tsx を書き換える**

```typescript
// src/features/portfolio/components/HoldingModal.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Holding, HoldingSaveInput, Stock } from "@/types";
import { searchStocks } from "@/services/stocksApi";

interface Props {
  holding?: Holding | null;
  onSave: (data: HoldingSaveInput) => void;
  onClose: () => void;
}

export default function HoldingModal({ holding, onSave, onClose }: Props) {
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [stockQuery, setStockQuery] = useState("");
  const [stockResults, setStockResults] = useState<Stock[]>([]);
  const [searching, setSearching] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");

  useEffect(() => {
    if (holding) {
      setStockQuery(holding.ticker);
      setSelectedStock({
        id: holding.stockId,
        ticker: holding.ticker,
        name: holding.name,
        sector: holding.sector,
        currentPrice: holding.currentPrice,
        per: holding.per,
        pbr: holding.pbr,
        dividendYield: holding.dividendYield,
        marketCap: holding.marketCap,
      });
      setQuantity(String(holding.quantity));
      setPurchasePrice(String(holding.purchasePrice));
      setPurchaseDate(
        holding.purchaseDate
          ? new Date(holding.purchaseDate).toISOString().split("T")[0]
          : ""
      );
    }
  }, [holding]);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 1) { setStockResults([]); return; }
    setSearching(true);
    try {
      setStockResults(await searchStocks({ q, limit: "10" }));
    } catch {
      setStockResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (selectedStock) return;
    const t = setTimeout(() => doSearch(stockQuery), 400);
    return () => clearTimeout(t);
  }, [stockQuery, doSearch, selectedStock]);

  function handleSelectStock(s: Stock) {
    setSelectedStock(s);
    setStockQuery(s.ticker);
    setStockResults([]);
  }

  function handleClearStock() {
    setSelectedStock(null);
    setStockQuery("");
    setStockResults([]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStock) return;
    onSave({
      id: holding?.id,
      stockId: selectedStock.id,
      quantity: parseFloat(quantity),
      purchasePrice: parseFloat(purchasePrice),
      purchaseDate: purchaseDate || null,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 my-4">
        <h2 className="text-lg font-bold mb-5">{holding ? "銘柄を編集" : "銘柄を追加"}</h2>

        {/* 銘柄選択 */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            銘柄 <span className="text-red-400">*</span>
            <span className="text-gray-400 font-normal ml-1">（スクリーニングで登録済みの銘柄から選択）</span>
          </label>

          {selectedStock ? (
            <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
              <div>
                <span className="font-mono text-indigo-700 text-sm font-medium">{selectedStock.ticker}</span>
                <span className="text-gray-700 ml-2 text-sm">{selectedStock.name}</span>
                {selectedStock.sector && (
                  <span className="text-gray-400 text-xs ml-2">{selectedStock.sector}</span>
                )}
              </div>
              {!holding && (
                <button
                  type="button"
                  onClick={handleClearStock}
                  className="text-gray-400 hover:text-gray-600 text-xs ml-2"
                >
                  変更
                </button>
              )}
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={stockQuery}
                onChange={(e) => setStockQuery(e.target.value)}
                placeholder="ティッカーまたは銘柄名で検索..."
                className="input w-full"
                autoFocus
              />
              {searching && <p className="text-xs text-gray-400 mt-1">検索中...</p>}
              {stockResults.length > 0 && (
                <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 overflow-hidden">
                  {stockResults.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectStock(s)}
                      className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 text-sm border-b border-gray-100 last:border-0"
                    >
                      <span className="font-mono font-medium text-indigo-700">{s.ticker}</span>
                      <span className="text-gray-600 ml-2">{s.name}</span>
                      {s.sector && <span className="text-gray-400 text-xs ml-1">{s.sector}</span>}
                    </button>
                  ))}
                </div>
              )}
              {!searching && stockQuery.length >= 1 && stockResults.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  見つかりません。先にスクリーニング画面で銘柄を登録してください。
                </p>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="保有数" required>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="100"
                min="0"
                step="any"
                required
                className="input"
              />
            </Field>
            <Field label="購入単価 (¥)" required>
              <input
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="1500"
                min="0"
                step="any"
                required
                className="input"
              />
            </Field>
          </div>

          <Field label="購入日">
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="input"
            />
          </Field>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={!selectedStock}
              className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
            >
              {holding ? "更新" : "追加"}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .input { width: 100%; border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px 12px; font-size: 14px; outline: none; }
        .input:focus { box-shadow: 0 0 0 3px rgba(99,102,241,0.2); border-color: #6366f1; }
      `}</style>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: page.tsx の handleSave シグネチャを確認・更新する**

`src/app/page.tsx` の `handleSave` が `Omit<Holding, "id"> & { id?: string }` を受け取っている場合は `HoldingSaveInput` に変更する：

```typescript
// src/app/page.tsx の該当部分
import { Holding, HoldingSaveInput } from "@/types";
// ...
async function handleSave(data: HoldingSaveInput) {
  await save(data);
  setModalOpen(false);
  setEditingHolding(null);
}
// ...
<HoldingModal
  holding={editingHolding}
  onSave={handleSave}
  onClose={() => { setModalOpen(false); setEditingHolding(null); }}
/>
```

- [ ] **Step 3: TypeScript チェック（エラー0件を確認）**

```bash
npx tsc --noEmit
```

Expected: **エラー0件**（無出力）。

- [ ] **Step 4: コミット**

```bash
git add src/features/portfolio/components/HoldingModal.tsx src/app/page.tsx
git commit -m "feat: update HoldingModal to use stockId-based form"
```

---

## Task 10: 最終確認とプッシュ

全変更の TypeScript チェックと動作確認を行い、プッシュする。

- [ ] **Step 1: TypeScript チェック（最終確認）**

```bash
npx tsc --noEmit
```

Expected: エラー0件。

- [ ] **Step 2: ビルド確認**

```bash
npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` が表示される（またはエラーなし）。

- [ ] **Step 3: 成功基準チェック**

手動で以下を確認する：

```
- [ ] prisma studio で Holding テーブルに name/ticker/currentPrice 等の旧カラムがないこと
      npx prisma studio  →  ブラウザで確認
- [ ] SyncJob テーブルが空 or id="singleton" の1件のみであること
- [ ] npx tsc --noEmit がエラー0件
```

- [ ] **Step 4: プッシュ**

```bash
git push origin master
```

---

## 成功基準チェックリスト

- [ ] `Holding` テーブルに `name`, `ticker`, `sector`, `currentPrice`, `per`, `pbr`, `dividendYield`, `marketCap` カラムが存在しない
- [ ] `Holding.stockId` が NOT NULL で `Stock` への FK が設定されている
- [ ] `SyncJob` が常に `id = "singleton"` の1件のみ
- [ ] `SyncJob.status` が `SyncStatus` enum で管理されている
- [ ] `GET /api/holdings` が `currentPrice` を `Stock.currentPrice` から返す
- [ ] `npx tsc --noEmit` がエラー0件
- [ ] 全機能（CRUD・チャート・スクリーニング・AI）が動作する
