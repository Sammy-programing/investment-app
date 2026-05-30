# 東証全銘柄自動取得 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** J-Quants API と JPX 信用残CSV を使い、サーバー起動時に東証全銘柄（約3,800銘柄）の株価・財務データ・信用倍率を自動でDBに格納する。

**Architecture:** `src/instrumentation.ts`（Next.js サーバー起動フック）が `src/lib/stockInitializer.ts` を呼び出し、J-Quants API（銘柄・株価・財務）と JPX信用残CSV（信用倍率）からデータを取得してDBへ一括upsertする。Yahoo Finance 関連コードは完全削除する。

**Tech Stack:** Next.js 16 instrumentation API, J-Quants REST API, JPX CSV (Shift-JIS), iconv-lite, Prisma, TypeScript

---

## ファイルマップ

| 操作 | パス |
|------|------|
| 新規 | `src/services/jquantsApi.ts` |
| 新規 | `src/services/jpxMarginApi.ts` |
| 新規 | `src/lib/stockInitializer.ts` |
| 新規 | `src/instrumentation.ts` |
| 更新 | `prisma/schema.prisma` |
| 更新 | `src/app/api/stocks/route.ts` |
| 更新 | `src/features/screening/hooks/useScreening.ts` |
| 更新 | `src/features/screening/components/StockScreening.tsx` |
| 更新 | `src/services/stocksApi.ts` |
| 更新 | `src/components/AppShell.tsx` |
| 更新 | `src/types/index.ts` |
| 削除 | `src/app/api/stocks/seed/route.ts` |
| 削除 | `src/app/api/stocks/import/route.ts` |
| 削除 | `src/app/api/stocks/sync/route.ts` |
| 削除 | `src/hooks/useAutoSync.ts` |
| 削除 | `src/features/screening/hooks/useStockSync.ts` |

---

## Task 1: iconv-lite インストール + Prisma スキーマ更新

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: iconv-lite をインストールする**

```bash
cd investment-app
npm install iconv-lite
npm install --save-dev @types/iconv-lite
```

Expected: `package.json` の dependencies に `iconv-lite` が追加される。

- [ ] **Step 2: schema.prisma に shinyoBairitsu を追加する**

`prisma/schema.prisma` の `Stock` モデルに以下のフィールドを追加する（`roe` フィールドの直後）：

```prisma
  roe            Float?
  shinyoBairitsu Float?    // 信用倍率（信用買残÷信用売残）
  lastUpdated    DateTime?
```

- [ ] **Step 3: マイグレーションを実行する**

```bash
npx prisma migrate dev --name add_shinyo_bairitsu
npx prisma generate
```

Expected: `✔ Generated Prisma Client` が表示される。

- [ ] **Step 4: TypeScript チェック**

```bash
npx tsc --noEmit
```

Expected: エラー0件。

- [ ] **Step 5: コミット**

```bash
git add prisma/schema.prisma prisma/migrations/ package.json package-lock.json
git commit -m "feat: add shinyoBairitsu field and install iconv-lite"
```

---

## Task 2: J-Quants API サービスを作成する

**Files:**
- Create: `src/services/jquantsApi.ts`

J-Quants はサーバーサイド専用（API キーはサーバー環境変数）。

- [ ] **Step 1: `src/services/jquantsApi.ts` を作成する**

```typescript
// src/services/jquantsApi.ts
const BASE = "https://api.jpx-jquants.com/v1";

export interface JQuantsListedInfo {
  Code: string;             // "72030"（5桁）
  CompanyName: string;
  Sector33CodeName: string;
  MarketCodeName: string;
}

export interface JQuantsQuote {
  Code: string;
  Close: number | null;
  TurnoverValue: number | null;
}

export interface JQuantsStatement {
  Code: string;
  DisclosedDate: string;    // "2024-02-06"
  EarningsPerShare: string; // 文字列で返される
  BookValuePerShare: string;
}

export interface JQuantsDividend {
  Code: string;
  ReferenceDate: string;    // "2024-03-29"
  AnnualDividendPerShare: string;
}

async function getRefreshToken(): Promise<string> {
  const res = await fetch(`${BASE}/token/auth_user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mailaddress: process.env.JQUANTS_EMAIL,
      password: process.env.JQUANTS_PASSWORD,
    }),
  });
  if (!res.ok) throw new Error(`J-Quants auth_user failed: ${res.status}`);
  const data = await res.json();
  return data.refreshToken as string;
}

async function getIdTokenFromRefresh(refreshToken: string): Promise<string> {
  const res = await fetch(`${BASE}/token/auth_refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshtoken: refreshToken }),
  });
  if (!res.ok) throw new Error(`J-Quants auth_refresh failed: ${res.status}`);
  const data = await res.json();
  return data.idToken as string;
}

export async function getJQuantsToken(): Promise<string> {
  const refreshToken = await getRefreshToken();
  return getIdTokenFromRefresh(refreshToken);
}

async function fetchAllPages<T>(idToken: string, path: string, key: string): Promise<T[]> {
  const results: T[] = [];
  let paginationKey: string | undefined;

  do {
    const url = new URL(`${BASE}${path}`);
    if (paginationKey) url.searchParams.set("pagination_key", paginationKey);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) throw new Error(`J-Quants ${path} failed: ${res.status}`);
    const data = await res.json();

    const items = data[key];
    if (Array.isArray(items)) results.push(...items);
    paginationKey = data.pagination_key as string | undefined;
  } while (paginationKey);

  return results;
}

export async function fetchListedInfo(idToken: string): Promise<JQuantsListedInfo[]> {
  return fetchAllPages<JQuantsListedInfo>(idToken, "/listed/info", "info");
}

export function getPreviousTradingDate(): string {
  const d = new Date();
  // 土曜(6)→金曜(-1日), 日曜(0)→金曜(-2日), 月曜(1)→金曜(-3日), それ以外→前日
  const offsets: Record<number, number> = { 6: 1, 0: 2, 1: 3 };
  const offset = offsets[d.getDay()] ?? 1;
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10).replace(/-/g, ""); // "YYYYMMDD"
}

export async function fetchDailyQuotes(idToken: string, date: string): Promise<JQuantsQuote[]> {
  return fetchAllPages<JQuantsQuote>(idToken, `/prices/daily_quotes?date=${date}`, "daily_quotes");
}

export async function fetchFinStatements(idToken: string): Promise<JQuantsStatement[]> {
  return fetchAllPages<JQuantsStatement>(idToken, "/fins/statements", "statements");
}

export async function fetchDividend(idToken: string): Promise<JQuantsDividend[]> {
  return fetchAllPages<JQuantsDividend>(idToken, "/fins/dividend", "dividend");
}
```

- [ ] **Step 2: TypeScript チェック**

```bash
npx tsc --noEmit
```

Expected: エラー0件。

- [ ] **Step 3: コミット**

```bash
git add src/services/jquantsApi.ts
git commit -m "feat: add J-Quants API service (auth, listed info, quotes, financials)"
```

---

## Task 3: JPX 信用残 API サービスを作成する

**Files:**
- Create: `src/services/jpxMarginApi.ts`

- [ ] **Step 1: `src/services/jpxMarginApi.ts` を作成する**

```typescript
// src/services/jpxMarginApi.ts
import { decode } from "iconv-lite";

const INDEX_URL = "https://www.jpx.co.jp/markets/statistics-equities/margin/index.html";
const JPX_BASE = "https://www.jpx.co.jp";

async function getLatestMarginCsvUrl(): Promise<string> {
  const res = await fetch(INDEX_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; investment-app/1.0)" },
  });
  if (!res.ok) throw new Error(`JPX margin index fetch failed: ${res.status}`);
  const html = await res.text();

  // ページ内の最初の .csv リンクを取得
  const match = html.match(/href="([^"]+\.csv)"/i);
  if (!match) throw new Error("JPX margin CSV link not found");
  const path = match[1];
  return path.startsWith("http") ? path : `${JPX_BASE}${path}`;
}

export async function fetchShinyoBairitsu(): Promise<Map<string, number>> {
  const csvUrl = await getLatestMarginCsvUrl();

  const res = await fetch(csvUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; investment-app/1.0)" },
  });
  if (!res.ok) throw new Error(`JPX margin CSV fetch failed: ${res.status}`);

  const buffer = await res.arrayBuffer();
  const text = decode(Buffer.from(buffer), "shift-jis");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // ヘッダー行をスキップ（コードが4桁数字の行だけを処理）
  const result = new Map<string, number>();

  for (const line of lines) {
    const cols = line.split(",").map((c) => c.trim().replace(/"/g, ""));
    const code = cols[0];
    if (!/^\d{4}$/.test(code)) continue; // 4桁コード以外はスキップ

    // 信用倍率は col[6]。信用買残(col[2]) / 信用売残(col[4]) でも計算可能
    const directRatio = parseFloat(cols[6]);
    if (!isNaN(directRatio) && directRatio > 0) {
      result.set(code, directRatio);
      continue;
    }
    // col[6] が無効な場合は計算
    const buy = parseFloat(cols[2]);
    const sell = parseFloat(cols[4]);
    if (!isNaN(buy) && !isNaN(sell) && sell > 0) {
      result.set(code, parseFloat((buy / sell).toFixed(2)));
    }
  }

  return result;
}
```

- [ ] **Step 2: TypeScript チェック**

```bash
npx tsc --noEmit
```

Expected: エラー0件。

- [ ] **Step 3: コミット**

```bash
git add src/services/jpxMarginApi.ts
git commit -m "feat: add JPX margin CSV service for shinyo-bairitsu"
```

---

## Task 4: Stock Initializer を作成する

**Files:**
- Create: `src/lib/stockInitializer.ts`

- [ ] **Step 1: `src/lib/stockInitializer.ts` を作成する**

```typescript
// src/lib/stockInitializer.ts
import { prisma } from "@/lib/prisma";
import {
  getJQuantsToken,
  fetchListedInfo,
  fetchDailyQuotes,
  fetchFinStatements,
  fetchDividend,
  getPreviousTradingDate,
  JQuantsStatement,
  JQuantsDividend,
} from "@/services/jquantsApi";
import { fetchShinyoBairitsu } from "@/services/jpxMarginApi";

// J-Quantsの5桁コード "72030" → 4桁コード "7203"
function normalizeCode(code: string): string {
  return code.length === 5 && code.endsWith("0") ? code.slice(0, 4) : code;
}

// 既存レコードの ticker を "7203.T" → "7203" に正規化
async function normalizeExistingTickers(): Promise<void> {
  await prisma.$executeRaw`UPDATE "Stock" SET ticker = REPLACE(ticker, '.T', '') WHERE ticker LIKE '%.T'`;
}

// Step 1: 銘柄リストを upsert
async function upsertListedInfo(idToken: string): Promise<void> {
  const info = await fetchListedInfo(idToken);
  const BATCH = 500;
  for (let i = 0; i < info.length; i += BATCH) {
    const batch = info.slice(i, i + BATCH);
    await prisma.$transaction(
      batch.map((s) =>
        prisma.stock.upsert({
          where: { ticker: normalizeCode(s.Code) },
          create: {
            ticker: normalizeCode(s.Code),
            name: s.CompanyName,
            sector: s.Sector33CodeName || null,
            market: s.MarketCodeName || null,
          },
          update: {
            name: s.CompanyName,
            sector: s.Sector33CodeName || null,
            market: s.MarketCodeName || null,
          },
        })
      )
    );
  }
  console.log(`[init] upserted ${info.length} stocks`);
}

// Step 2: 前日株価を更新
async function updatePrices(idToken: string): Promise<void> {
  const date = getPreviousTradingDate();
  const quotes = await fetchDailyQuotes(idToken, date);
  const BATCH = 500;
  for (let i = 0; i < quotes.length; i += BATCH) {
    const batch = quotes.slice(i, i + BATCH);
    await prisma.$transaction(
      batch
        .filter((q) => q.Close != null)
        .map((q) =>
          prisma.stock.updateMany({
            where: { ticker: normalizeCode(q.Code) },
            data: {
              currentPrice: q.Close,
              lastUpdated: new Date(),
            },
          })
        )
    );
  }
  console.log(`[init] updated prices for ${quotes.length} stocks (date: ${date})`);
}

// Step 3: 財務データを更新（EPS・純資産/株 → PER・PBR計算）
async function updateFinancials(idToken: string): Promise<void> {
  const statements = await fetchFinStatements(idToken);

  // 各銘柄の最新決算を取得
  const latest = new Map<string, JQuantsStatement>();
  for (const s of statements) {
    const code = normalizeCode(s.Code);
    const existing = latest.get(code);
    if (!existing || s.DisclosedDate > existing.DisclosedDate) {
      latest.set(code, s);
    }
  }

  // 現在株価を取得して PER/PBR を計算
  const tickers = Array.from(latest.keys());
  const stocks = await prisma.stock.findMany({
    where: { ticker: { in: tickers } },
    select: { ticker: true, currentPrice: true },
  });
  const priceMap = new Map(stocks.map((s) => [s.ticker, s.currentPrice]));

  const updates = Array.from(latest.entries()).map(([code, stmt]) => {
    const price = priceMap.get(code);
    const eps = parseFloat(stmt.EarningsPerShare);
    const bvps = parseFloat(stmt.BookValuePerShare);
    const per = price && eps > 0 ? parseFloat((price / eps).toFixed(2)) : null;
    const pbr = price && bvps > 0 ? parseFloat((price / bvps).toFixed(2)) : null;
    return prisma.stock.updateMany({
      where: { ticker: code },
      data: { per, pbr, eps: isNaN(eps) ? null : eps },
    });
  });

  const BATCH = 500;
  for (let i = 0; i < updates.length; i += BATCH) {
    await prisma.$transaction(updates.slice(i, i + BATCH));
  }
  console.log(`[init] updated financials for ${latest.size} stocks`);
}

// Step 4: 配当利回りを更新
async function updateDividends(idToken: string): Promise<void> {
  const dividends = await fetchDividend(idToken);

  // 各銘柄の最新配当を取得
  const latest = new Map<string, JQuantsDividend>();
  for (const d of dividends) {
    const code = normalizeCode(d.Code);
    const existing = latest.get(code);
    if (!existing || d.ReferenceDate > existing.ReferenceDate) {
      latest.set(code, d);
    }
  }

  const tickers = Array.from(latest.keys());
  const stocks = await prisma.stock.findMany({
    where: { ticker: { in: tickers } },
    select: { ticker: true, currentPrice: true },
  });
  const priceMap = new Map(stocks.map((s) => [s.ticker, s.currentPrice]));

  const updates = Array.from(latest.entries()).map(([code, div]) => {
    const price = priceMap.get(code);
    const annual = parseFloat(div.AnnualDividendPerShare);
    const dy = price && annual > 0 ? parseFloat(((annual / price) * 100).toFixed(2)) : null;
    return prisma.stock.updateMany({
      where: { ticker: code },
      data: { dividendYield: dy },
    });
  });

  const BATCH = 500;
  for (let i = 0; i < updates.length; i += BATCH) {
    await prisma.$transaction(updates.slice(i, i + BATCH));
  }
  console.log(`[init] updated dividends for ${latest.size} stocks`);
}

// Step 5: 信用倍率を更新
async function updateMargin(): Promise<void> {
  const marginMap = await fetchShinyoBairitsu();
  const entries = Array.from(marginMap.entries());

  const BATCH = 500;
  for (let i = 0; i < entries.length; i += BATCH) {
    await prisma.$transaction(
      entries.slice(i, i + BATCH).map(([code, ratio]) =>
        prisma.stock.updateMany({
          where: { ticker: code },
          data: { shinyoBairitsu: ratio },
        })
      )
    );
  }
  console.log(`[init] updated shinyo-bairitsu for ${entries.length} stocks`);
}

export async function initializeStockData(): Promise<void> {
  console.log("[init] starting stock data initialization...");

  // 既存 ticker を正規化（"7203.T" → "7203"）
  await normalizeExistingTickers();

  const idToken = await getJQuantsToken();

  await upsertListedInfo(idToken);
  await updatePrices(idToken);
  await updateFinancials(idToken);
  await updateDividends(idToken);
  await updateMargin();

  console.log("[init] stock data initialization complete");
}
```

- [ ] **Step 2: TypeScript チェック**

```bash
npx tsc --noEmit
```

Expected: エラー0件。

- [ ] **Step 3: コミット**

```bash
git add src/lib/stockInitializer.ts
git commit -m "feat: add stock initializer (J-Quants + JPX margin data)"
```

---

## Task 5: instrumentation.ts を作成する

**Files:**
- Create: `src/instrumentation.ts`

- [ ] **Step 1: `src/instrumentation.ts` を作成する**

```typescript
// src/instrumentation.ts
export async function register() {
  // Node.js ランタイムでのみ実行（Edge Runtime では実行しない）
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // 環境変数未設定の場合はスキップ（開発環境での任意実行）
  if (!process.env.JQUANTS_EMAIL || !process.env.JQUANTS_PASSWORD) {
    console.log("[init] JQUANTS_EMAIL/PASSWORD not set, skipping stock initialization");
    return;
  }

  try {
    const { initializeStockData } = await import("@/lib/stockInitializer");
    await initializeStockData();
  } catch (e) {
    // エラーでサーバー起動を止めない
    console.error("[init] stock initialization failed:", e);
  }
}
```

- [ ] **Step 2: Next.js が instrumentation を認識するか確認する**

`next.config.ts`（または `next.config.js`）に `instrumentationHook: true` が必要か確認する。Next.js 15 以降はデフォルトで有効なので設定不要の場合が多い。

```bash
# next.config.ts を確認
cat next.config.ts 2>/dev/null || cat next.config.js 2>/dev/null || cat next.config.mjs 2>/dev/null
```

もし `experimental: { instrumentationHook: true }` が必要な場合は追加する（Next.js 14 以前のみ）。Next.js 15/16 では不要。

- [ ] **Step 3: TypeScript チェック**

```bash
npx tsc --noEmit
```

Expected: エラー0件。

- [ ] **Step 4: コミット**

```bash
git add src/instrumentation.ts
git commit -m "feat: add instrumentation.ts for server-startup stock data init"
```

---

## Task 6: 旧 API ルートを削除 + stocksApi.ts を整理する

**Files:**
- Delete: `src/app/api/stocks/seed/route.ts`
- Delete: `src/app/api/stocks/import/route.ts`
- Delete: `src/app/api/stocks/sync/route.ts`
- Modify: `src/services/stocksApi.ts`

- [ ] **Step 1: 旧 API ルートを削除する**

```bash
rm src/app/api/stocks/seed/route.ts
rm src/app/api/stocks/import/route.ts
rm src/app/api/stocks/sync/route.ts
```

ディレクトリが空になる場合も削除する：

```bash
# ディレクトリが空なら削除
rmdir src/app/api/stocks/seed 2>/dev/null
rmdir src/app/api/stocks/import 2>/dev/null
rmdir src/app/api/stocks/sync 2>/dev/null
```

- [ ] **Step 2: stocksApi.ts から不要な関数を削除する**

`src/services/stocksApi.ts` を以下に書き換える（不要な関数を削除）：

```typescript
// src/services/stocksApi.ts
import { Stock } from "@/types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`API error: ${res.status} ${url}`);
  return res.json();
}

export async function searchStocks(params: Record<string, string>): Promise<Stock[]> {
  const p = new URLSearchParams(params);
  return request<Stock[]>(`/api/stocks?${p}`);
}
```

削除するもの: `SyncJobResult`, `StockQuote`, `searchStocksByQuery`, `fetchStockQuote`, `getSyncCount`, `syncStocks`, `seedNikkei225`, `importStocksCsv`

- [ ] **Step 3: TypeScript チェック**

```bash
npx tsc --noEmit
```

Expected: エラー0件。`searchStocksByQuery` や `fetchStockQuote` を参照しているファイルがあればエラーが出る — その場合は参照元を確認して削除する。

- [ ] **Step 4: コミット**

```bash
git add -A
git commit -m "feat: remove Yahoo Finance sync routes and unused stocksApi functions"
```

---

## Task 7: GET /api/stocks に信用倍率フィルターを追加する

**Files:**
- Modify: `src/app/api/stocks/route.ts`
- Modify: `src/features/screening/hooks/useScreening.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Stock 型に shinyoBairitsu を追加する**

`src/types/index.ts` の `Stock` インターフェースに追加：

```typescript
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
  shinyoBairitsu?: number | null;   // ← 追加
  lastUpdated?: string | null;
}
```

- [ ] **Step 2: GET /api/stocks に shinyoBairitsuMax フィルターを追加する**

`src/app/api/stocks/route.ts` を以下に書き換える：

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const p = new URL(req.url).searchParams;
  const q = p.get("q") ?? "";
  const sector = p.get("sector") ?? "";
  const market = p.get("market") ?? "";
  const perMax = p.get("perMax") ? parseFloat(p.get("perMax")!) : undefined;
  const pbrMax = p.get("pbrMax") ? parseFloat(p.get("pbrMax")!) : undefined;
  const dyMin = p.get("dyMin") ? parseFloat(p.get("dyMin")!) : undefined;
  const marketCapMin = p.get("marketCapMin") ? parseFloat(p.get("marketCapMin")!) : undefined;
  const marketCapMax = p.get("marketCapMax") ? parseFloat(p.get("marketCapMax")!) : undefined;
  const shinyoBairitsuMax = p.get("shinyoBairitsuMax") ? parseFloat(p.get("shinyoBairitsuMax")!) : undefined;
  const limit = Math.min(parseInt(p.get("limit") ?? "100"), 500);

  const stocks = await prisma.stock.findMany({
    where: {
      AND: [
        q ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { ticker: { contains: q, mode: "insensitive" } },
          ],
        } : {},
        sector ? { sector } : {},
        market ? { market } : {},
        perMax != null ? { per: { lte: perMax, not: null } } : {},
        pbrMax != null ? { pbr: { lte: pbrMax, not: null } } : {},
        dyMin != null ? { dividendYield: { gte: dyMin, not: null } } : {},
        marketCapMin != null ? { marketCap: { gte: marketCapMin, not: null } } : {},
        marketCapMax != null ? { marketCap: { lte: marketCapMax, not: null } } : {},
        shinyoBairitsuMax != null ? { shinyoBairitsu: { lte: shinyoBairitsuMax, not: null } } : {},
      ],
    },
    orderBy: { marketCap: "desc" },
    take: limit,
  });

  return NextResponse.json(stocks);
}
```

- [ ] **Step 3: useScreening.ts に shinyoBairitsuMax を追加する**

`src/features/screening/hooks/useScreening.ts` を以下に書き換える：

```typescript
// src/features/screening/hooks/useScreening.ts
import { useState } from "react";
import { Stock } from "@/types";
import { searchStocks } from "@/services/stocksApi";

interface Criteria {
  q: string;
  sector: string;
  market: string;
  perMax: string;
  pbrMax: string;
  dyMin: string;
  marketCapMin: string;
  marketCapMax: string;
  shinyoBairitsuMax: string;
}

const INITIAL_CRITERIA: Criteria = {
  q: "", sector: "", market: "",
  perMax: "", pbrMax: "", dyMin: "",
  marketCapMin: "", marketCapMax: "",
  shinyoBairitsuMax: "",
};

export function useScreening() {
  const [criteria, setCriteria] = useState<Criteria>(INITIAL_CRITERIA);
  const [results, setResults] = useState<Stock[] | null>(null);
  const [searching, setSearching] = useState(false);

  function set(field: keyof Criteria) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setCriteria((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function screen() {
    setSearching(true);
    try {
      const params: Record<string, string> = { limit: "200" };
      (Object.entries(criteria) as [string, string][]).forEach(([k, v]) => {
        if (v) params[k] = v;
      });
      setResults(await searchStocks(params));
    } finally {
      setSearching(false);
    }
  }

  function reset() {
    setCriteria(INITIAL_CRITERIA);
    setResults(null);
  }

  return { criteria, set, results, searching, screen, reset };
}
```

- [ ] **Step 4: TypeScript チェック**

```bash
npx tsc --noEmit
```

Expected: エラー0件。

- [ ] **Step 5: コミット**

```bash
git add src/app/api/stocks/route.ts src/features/screening/hooks/useScreening.ts src/types/index.ts
git commit -m "feat: add shinyoBairitsuMax filter to screening API and hook"
```

---

## Task 8: StockScreening UI を更新する

**Files:**
- Modify: `src/features/screening/components/StockScreening.tsx`

種まきボタン・CSV取込ボタン・`useStockSync` の依存を削除し、信用倍率フィルター・カラムを追加する。

- [ ] **Step 1: StockScreening.tsx を書き換える**

```tsx
// src/features/screening/components/StockScreening.tsx
"use client";

import { useScreening } from "../hooks/useScreening";
import { Stock } from "@/types";

const SECTORS = [
  "", "水産・農林", "鉱業", "建設", "食品", "繊維", "パルプ・紙", "化学",
  "医薬品", "石油・石炭", "ゴム", "ガラス・土石", "鉄鋼", "非鉄金属",
  "機械", "電機", "輸送用機器", "精密機器", "商社", "小売", "銀行",
  "証券・商品先物", "保険", "その他金融", "不動産", "陸運", "海運",
  "空運", "倉庫・運輸", "情報・通信", "電力・ガス", "サービス", "その他",
];

const MARKETS = ["", "プライム", "スタンダード", "グロース"];

interface Props {
  onAddStock?: (stock: Stock) => void;
}

export default function StockScreening({ onAddStock }: Props) {
  const { criteria, set, results, searching, screen, reset } = useScreening();

  const inputStyle = {
    background: "var(--bg-page)",
    borderColor: "var(--border-card)",
    color: "var(--text-main)",
    border: "1px solid var(--border-card)",
    borderRadius: "10px",
    padding: "8px 12px",
    fontSize: "14px",
    outline: "none",
    width: "100%",
  };

  return (
    <div className="space-y-5">
      {/* スクリーニング条件 */}
      <div
        className="rounded-xl border p-5 space-y-4"
        style={{ background: "var(--bg-card)", borderColor: "var(--border-card)" }}
      >
        <p className="text-sm font-medium" style={{ color: "var(--text-sub)" }}>スクリーニング条件</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className="text-xs block mb-1" style={{ color: "var(--text-sub)" }}>銘柄名・ティッカー</label>
            <input type="text" value={criteria.q} onChange={set("q")} placeholder="例: トヨタ, 7203" style={inputStyle} />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: "var(--text-sub)" }}>セクター</label>
            <select value={criteria.sector} onChange={set("sector")} style={inputStyle}>
              {SECTORS.map((s) => <option key={s} value={s}>{s || "すべて"}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: "var(--text-sub)" }}>市場</label>
            <select value={criteria.market} onChange={set("market")} style={inputStyle}>
              {MARKETS.map((m) => <option key={m} value={m}>{m || "すべて"}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: "var(--text-sub)" }}>PER 以下</label>
            <input type="number" value={criteria.perMax} onChange={set("perMax")} placeholder="例: 20" step="any" style={inputStyle} />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: "var(--text-sub)" }}>PBR 以下</label>
            <input type="number" value={criteria.pbrMax} onChange={set("pbrMax")} placeholder="例: 2" step="any" style={inputStyle} />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: "var(--text-sub)" }}>配当利回り% 以上</label>
            <input type="number" value={criteria.dyMin} onChange={set("dyMin")} placeholder="例: 3" step="any" style={inputStyle} />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: "var(--text-sub)" }}>時価総額 下限(億円)</label>
            <input type="number" value={criteria.marketCapMin} onChange={set("marketCapMin")} placeholder="例: 1000" step="any" style={inputStyle} />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: "var(--text-sub)" }}>信用倍率 以下</label>
            <input type="number" value={criteria.shinyoBairitsuMax} onChange={set("shinyoBairitsuMax")} placeholder="例: 3" step="0.01" style={inputStyle} />
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={screen}
            disabled={searching}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 transition-opacity"
            style={{ background: "var(--accent)" }}
          >
            {searching ? "検索中..." : "スクリーニング実行"}
          </button>
          <button
            onClick={reset}
            className="px-5 rounded-xl text-sm font-medium transition-colors hover:bg-white/5"
            style={{ border: "1px solid var(--border-card)", color: "var(--text-sub)" }}
          >
            リセット
          </button>
        </div>
      </div>

      {/* 結果テーブル */}
      {results !== null && (
        <div
          className="rounded-xl border"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-card)" }}
        >
          <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border-card)" }}>
            <span className="text-sm" style={{ color: "var(--text-sub)" }}>
              結果: <span className="font-medium" style={{ color: "var(--text-main)" }}>{results.length}件</span>
            </span>
          </div>
          {results.length === 0 ? (
            <p className="text-center py-10" style={{ color: "var(--text-sub)" }}>条件に一致する銘柄がありません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--border-card)", color: "var(--text-sub)" }}>
                    <th className="text-left px-5 py-3 font-medium">ティッカー</th>
                    <th className="text-left py-3 font-medium">銘柄名</th>
                    <th className="text-left py-3 font-medium">セクター</th>
                    <th className="text-right py-3 pr-4 font-medium">現在値</th>
                    <th className="text-right py-3 pr-4 font-medium">PER</th>
                    <th className="text-right py-3 pr-4 font-medium">PBR</th>
                    <th className="text-right py-3 pr-4 font-medium">配当%</th>
                    <th className="text-right py-3 pr-4 font-medium">信用倍率</th>
                    {onAddStock && <th className="py-3 pr-5"></th>}
                  </tr>
                </thead>
                <tbody>
                  {results.map((s) => (
                    <tr key={s.id} className="border-b hover:bg-white/3 transition-colors" style={{ borderColor: "var(--border-card)" }}>
                      <td className="px-5 py-2.5 font-mono text-xs" style={{ color: "var(--accent)" }}>{s.ticker}</td>
                      <td className="py-2.5 font-medium" style={{ color: "var(--text-main)" }}>{s.name}</td>
                      <td className="py-2.5 text-xs" style={{ color: "var(--text-sub)" }}>{s.sector ?? "-"}</td>
                      <td className="py-2.5 pr-4 text-right" style={{ color: "var(--text-main)" }}>{s.currentPrice != null ? `¥${s.currentPrice.toLocaleString()}` : "-"}</td>
                      <td className="py-2.5 pr-4 text-right" style={{ color: "var(--text-main)" }}>{s.per != null ? s.per.toFixed(1) : "-"}</td>
                      <td className="py-2.5 pr-4 text-right" style={{ color: "var(--text-main)" }}>{s.pbr != null ? s.pbr.toFixed(2) : "-"}</td>
                      <td className="py-2.5 pr-4 text-right" style={{ color: "var(--text-main)" }}>{s.dividendYield != null ? `${s.dividendYield.toFixed(2)}%` : "-"}</td>
                      <td className="py-2.5 pr-4 text-right" style={{ color: "var(--text-main)" }}>{s.shinyoBairitsu != null ? s.shinyoBairitsu.toFixed(2) : "-"}</td>
                      {onAddStock && (
                        <td className="py-2.5 pr-5 text-right">
                          <button
                            onClick={() => onAddStock(s)}
                            className="text-xs px-3 py-1 rounded-lg font-medium text-white transition-opacity hover:opacity-80"
                            style={{ background: "var(--accent)" }}
                          >
                            追加 +
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript チェック**

```bash
npx tsc --noEmit
```

Expected: エラー0件。

- [ ] **Step 3: コミット**

```bash
git add src/features/screening/components/StockScreening.tsx
git commit -m "feat: update StockScreening - remove seed/import UI, add shinyo-bairitsu column"
```

---

## Task 9: AppShell から useAutoSync を削除する + 旧フックを削除する

**Files:**
- Modify: `src/components/AppShell.tsx`
- Delete: `src/hooks/useAutoSync.ts`
- Delete: `src/features/screening/hooks/useStockSync.ts`

- [ ] **Step 1: AppShell.tsx から useAutoSync を削除する**

```tsx
// src/components/AppShell.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AIFloatingButton from "@/components/AIFloatingButton";

const NAV_ITEMS = [
  { href: "/", label: "概要", icon: "📊" },
  { href: "/portfolio", label: "保有一覧", icon: "📋" },
  { href: "/stocks", label: "銘柄DB", icon: "🔍" },
  { href: "/charts", label: "チャート", icon: "📈" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-screen" style={{ background: "var(--bg-page)" }}>
      {/* Header */}
      <header
        className="h-14 flex items-center px-6 flex-shrink-0"
        style={{ background: "var(--bg-sidebar)", borderBottom: "1px solid var(--border-card)" }}
      >
        <span className="font-bold text-white flex-1 text-base">▋ 投資管理</span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav
          className="w-[220px] flex-shrink-0 flex flex-col py-3"
          style={{ background: "var(--bg-sidebar)", borderRight: "1px solid var(--border-card)" }}
        >
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active ? "bg-indigo-600/20 text-white" : "hover:bg-white/5"
                }`}
                style={{
                  color: active ? "white" : "var(--text-sub)",
                  borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
                }}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Main */}
        <main className="flex-1 overflow-y-auto p-6 relative">
          {children}
          <AIFloatingButton />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 旧フックを削除する**

```bash
rm src/hooks/useAutoSync.ts
rm src/features/screening/hooks/useStockSync.ts
```

- [ ] **Step 3: 銘柄DB画面 (`src/app/stocks/page.tsx`) から useStockSync の参照がないことを確認する**

```bash
npx tsc --noEmit
```

Expected: エラー0件。もし `useStockSync` を参照しているファイルがあればエラーが出る — その場合は参照を削除する。

- [ ] **Step 4: コミット**

```bash
git add -A
git commit -m "feat: remove useAutoSync and useStockSync - sync now handled by instrumentation.ts"
```

---

## Task 10: 最終確認とプッシュ

- [ ] **Step 1: TypeScript チェック（最終）**

```bash
npx tsc --noEmit
```

Expected: **エラー0件**。

- [ ] **Step 2: ビルド確認**

```bash
npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully`。

- [ ] **Step 3: .env.local に環境変数を追加したことを確認する**

```bash
grep "JQUANTS" .env.local
```

Expected: `JQUANTS_EMAIL=...` と `JQUANTS_PASSWORD=...` が表示される。ない場合は追加する：

```
JQUANTS_EMAIL=your@email.com
JQUANTS_PASSWORD=yourpassword
```

- [ ] **Step 4: 成功基準チェック**

```
- [ ] npx tsc --noEmit がエラー0件
- [ ] 銘柄DBページに「日経225を登録する」「JPX CSVを取り込む」ボタンが存在しない
- [ ] スクリーニング条件に「信用倍率 以下」フィールドがある
- [ ] スクリーニング結果テーブルに「信用倍率」列がある
- [ ] src/app/api/stocks/seed/, import/, sync/ が存在しない
- [ ] src/hooks/useAutoSync.ts が存在しない
- [ ] AppShell に「同期中」表示が存在しない
```

- [ ] **Step 5: プッシュ**

```bash
git push origin master
```

---

## 成功基準

- サーバー起動後（J-Quants 認証が通れば）全銘柄の株価・PER・PBR・配当利回り・信用倍率がDBに格納される
- スクリーニング画面から信用倍率でフィルタリングできる
- Yahoo Finance 関連コードが完全に削除されている
- ユーザー操作なしに銘柄データが自動更新される
- `npx tsc --noEmit` がエラー0件
