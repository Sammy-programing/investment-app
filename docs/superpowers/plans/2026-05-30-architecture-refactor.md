# Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ロジックをカスタムフックと services 層に分離し、機能別フォルダ構成に整理してコード保守性を向上させる。

**Architecture:** `src/services/` で fetch を一元管理し、`src/features/<domain>/hooks/` でドメインロジックを担い、コンポーネントは表示のみに徹する。`src/app/page.tsx` はタブ切り替えとフック呼び出しだけの薄いオーケストレーターになる。

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Prisma + PostgreSQL, recharts

---

## ファイルマップ（作成・変更するファイル一覧）

| 操作 | パス |
|------|------|
| 作成 | `src/services/holdingsApi.ts` |
| 作成 | `src/services/stocksApi.ts` |
| 作成 | `src/services/aiApi.ts` |
| 作成 | `src/features/portfolio/hooks/usePortfolioStats.ts` |
| 作成 | `src/features/portfolio/hooks/useHoldings.ts` |
| 移動+更新 | `src/features/portfolio/components/PortfolioTable.tsx` |
| 移動+更新 | `src/features/portfolio/components/ProfitLossCard.tsx` |
| 移動+更新 | `src/features/portfolio/components/HoldingModal.tsx` |
| 作成 | `src/features/ai-advice/hooks/useAIChat.ts` |
| 移動+更新 | `src/features/ai-advice/components/AIAdviceChat.tsx` |
| 作成 | `src/features/screening/hooks/useScreening.ts` |
| 作成 | `src/features/screening/hooks/useStockSync.ts` |
| 移動+更新 | `src/features/screening/components/StockScreening.tsx` |
| 移動 | `src/features/charts/components/PortfolioChart.tsx` |
| 更新 | `src/app/page.tsx` |
| 削除 | `src/components/ScreeningPanel.tsx` |
| 削除 | `src/components/` (空になったら) |

**変更しないもの:** `src/app/api/`, `src/types/index.ts`, `src/lib/prisma.ts`, `src/data/nikkei225.ts`, `prisma/schema.prisma`

---

## Task 1: services/holdingsApi.ts を作成する

**Files:**
- Create: `src/services/holdingsApi.ts`

- [ ] **Step 1: ファイルを作成する**

```typescript
// src/services/holdingsApi.ts
import { Holding } from "@/types";

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

export async function createHolding(data: Omit<Holding, "id">): Promise<Holding> {
  return request<Holding>("/api/holdings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateHolding(id: string, data: Partial<Holding>): Promise<Holding> {
  return request<Holding>(`/api/holdings/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteHolding(id: string): Promise<void> {
  await request<void>(`/api/holdings/${id}`, { method: "DELETE" });
}
```

- [ ] **Step 2: TypeScript チェック**

```bash
cd investment-app && npx tsc --noEmit
```

エラーがないことを確認する。

- [ ] **Step 3: コミット**

```bash
git add src/services/holdingsApi.ts
git commit -m "feat: add holdingsApi service layer"
```

---

## Task 2: services/stocksApi.ts を作成する

**Files:**
- Create: `src/services/stocksApi.ts`

- [ ] **Step 1: ファイルを作成する**

```typescript
// src/services/stocksApi.ts
import { Stock, StockSearchResult } from "@/types";

export interface SyncJobResult {
  done: boolean;
  remaining: number;
  processed: number;
  total: number;
  failed: number;
  jobId: string;
}

export interface StockQuote {
  name: string;
  currentPrice?: number;
  per?: number;
  pbr?: number;
  dividendYield?: number;
  marketCap?: number;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`API error: ${res.status} ${url}`);
  return res.json();
}

export async function searchStocksByQuery(q: string): Promise<StockSearchResult[]> {
  return request<StockSearchResult[]>(`/api/stock/search?q=${encodeURIComponent(q)}`);
}

export async function fetchStockQuote(ticker: string): Promise<StockQuote> {
  return request<StockQuote>(`/api/stock/quote/${encodeURIComponent(ticker)}`);
}

export async function searchStocks(params: Record<string, string>): Promise<Stock[]> {
  const p = new URLSearchParams(params);
  return request<Stock[]>(`/api/stocks?${p}`);
}

export async function getSyncCount(): Promise<{ total: number }> {
  return request<{ total: number }>("/api/stocks/sync");
}

export async function syncStocks(jobId?: string): Promise<SyncJobResult> {
  return request<SyncJobResult>("/api/stocks/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId }),
  });
}

export async function seedNikkei225(): Promise<{ seeded: number }> {
  return request<{ seeded: number }>("/api/stocks/seed", { method: "POST" });
}

export async function importStocksCsv(text: string): Promise<{ imported: number; error?: string }> {
  return request<{ imported: number; error?: string }>("/api/stocks/import", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: text,
  });
}
```

- [ ] **Step 2: TypeScript チェック**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: コミット**

```bash
git add src/services/stocksApi.ts
git commit -m "feat: add stocksApi service layer"
```

---

## Task 3: services/aiApi.ts を作成する

**Files:**
- Create: `src/services/aiApi.ts`

- [ ] **Step 1: ファイルを作成する**

```typescript
// src/services/aiApi.ts
import { ChatMessage, Holding } from "@/types";

export async function streamAIAdvice(
  messages: ChatMessage[],
  holdings: Holding[]
): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  const res = await fetch("/api/ai-advice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, holdings }),
  });
  if (!res.ok) throw new Error(`AI API error: ${res.status}`);
  const reader = res.body?.getReader();
  if (!reader) throw new Error("ストリームが取得できませんでした");
  return reader;
}
```

- [ ] **Step 2: TypeScript チェック**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: コミット**

```bash
git add src/services/aiApi.ts
git commit -m "feat: add aiApi service layer"
```

---

## Task 4: portfolio フックを作成する

**Files:**
- Create: `src/features/portfolio/hooks/usePortfolioStats.ts`
- Create: `src/features/portfolio/hooks/useHoldings.ts`

- [ ] **Step 1: usePortfolioStats.ts を作成する**

```typescript
// src/features/portfolio/hooks/usePortfolioStats.ts
import { useMemo } from "react";
import { Holding, PortfolioStats } from "@/types";

export function usePortfolioStats(holdings: Holding[]): PortfolioStats {
  return useMemo(() => {
    const totalValue = holdings.reduce((s, h) => s + h.currentPrice * h.quantity, 0);
    const totalCost = holdings.reduce((s, h) => s + h.purchasePrice * h.quantity, 0);
    const totalProfitLoss = totalValue - totalCost;
    const totalProfitLossPercent = totalCost > 0 ? (totalProfitLoss / totalCost) * 100 : 0;
    return { totalValue, totalCost, totalProfitLoss, totalProfitLossPercent };
  }, [holdings]);
}
```

- [ ] **Step 2: useHoldings.ts を作成する**

```typescript
// src/features/portfolio/hooks/useHoldings.ts
import { useState, useEffect, useCallback } from "react";
import { Holding } from "@/types";
import { fetchHoldings, createHolding, updateHolding, deleteHolding } from "@/services/holdingsApi";

export function useHoldings() {
  const [allHoldings, setAllHoldings] = useState<Holding[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");

  const load = useCallback(async (q = searchQuery, sector = sectorFilter) => {
    const data = await fetchHoldings(q, sector);
    setHoldings(data);
    if (!q && !sector) setAllHoldings(data);
    setLoading(false);
  }, [searchQuery, sectorFilter]);

  // フィルターなしの全件を別途取得（stats 計算用）
  const loadAll = useCallback(async () => {
    const data = await fetchHoldings();
    setAllHoldings(data);
  }, []);

  useEffect(() => { load(); loadAll(); }, []);

  useEffect(() => {
    const t = setTimeout(() => load(searchQuery, sectorFilter), 300);
    return () => clearTimeout(t);
  }, [searchQuery, sectorFilter]);

  async function save(data: Omit<Holding, "id"> & { id?: string }) {
    if (data.id) {
      const { id, ...rest } = data;
      await updateHolding(id, rest);
    } else {
      await createHolding(data);
    }
    load();
    loadAll();
  }

  async function remove(id: string) {
    await deleteHolding(id);
    load();
    loadAll();
  }

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
npx tsc --noEmit
```

- [ ] **Step 4: コミット**

```bash
git add src/features/portfolio/hooks/
git commit -m "feat: add usePortfolioStats and useHoldings hooks"
```

---

## Task 5: portfolio コンポーネントを features/ へ移動する

**Files:**
- Create: `src/features/portfolio/components/PortfolioTable.tsx`（コピー＋import パス更新）
- Create: `src/features/portfolio/components/ProfitLossCard.tsx`（コピー＋import パス更新）
- Create: `src/features/portfolio/components/HoldingModal.tsx`（fetch → services 置き換え）

- [ ] **Step 1: PortfolioTable.tsx を作成する**

```typescript
// src/features/portfolio/components/PortfolioTable.tsx
"use client";

import { Holding } from "@/types";

interface Props {
  holdings: Holding[];
  onEdit: (holding: Holding) => void;
  onDelete: (id: string) => void;
}

export default function PortfolioTable({ holdings, onEdit, onDelete }: Props) {
  if (holdings.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">保有銘柄がありません</p>
        <p className="text-sm mt-1">「銘柄を追加」から投資銘柄を登録してください</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-600 text-left">
            <th className="pb-3 pr-4 font-medium">銘柄名</th>
            <th className="pb-3 pr-4 font-medium">ティッカー</th>
            <th className="pb-3 pr-4 font-medium text-right">保有数</th>
            <th className="pb-3 pr-4 font-medium text-right">購入単価</th>
            <th className="pb-3 pr-4 font-medium text-right">現在値</th>
            <th className="pb-3 pr-4 font-medium text-right">評価額</th>
            <th className="pb-3 pr-4 font-medium text-right">損益</th>
            <th className="pb-3 font-medium text-center">操作</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const value = h.currentPrice * h.quantity;
            const cost = h.purchasePrice * h.quantity;
            const pl = value - cost;
            const plPct = ((h.currentPrice - h.purchasePrice) / h.purchasePrice) * 100;
            const isPositive = pl >= 0;

            return (
              <tr key={h.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 pr-4 font-medium">{h.name}</td>
                <td className="py-3 pr-4 text-gray-600">{h.ticker}</td>
                <td className="py-3 pr-4 text-right">{h.quantity.toLocaleString()}</td>
                <td className="py-3 pr-4 text-right">¥{h.purchasePrice.toLocaleString()}</td>
                <td className="py-3 pr-4 text-right">¥{h.currentPrice.toLocaleString()}</td>
                <td className="py-3 pr-4 text-right font-medium">¥{value.toLocaleString()}</td>
                <td className={`py-3 pr-4 text-right font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}>
                  <div>{isPositive ? "+" : ""}¥{pl.toLocaleString()}</div>
                  <div className="text-xs">({isPositive ? "+" : ""}{plPct.toFixed(2)}%)</div>
                </td>
                <td className="py-3 text-center">
                  <button onClick={() => onEdit(h)} className="text-blue-600 hover:text-blue-800 mr-3 text-xs font-medium">
                    編集
                  </button>
                  <button onClick={() => onDelete(h.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">
                    削除
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: ProfitLossCard.tsx を作成する**

```typescript
// src/features/portfolio/components/ProfitLossCard.tsx
"use client";

import { PortfolioStats } from "@/types";

interface Props {
  stats: PortfolioStats;
}

export default function ProfitLossCard({ stats }: Props) {
  const isPositive = stats.totalProfitLoss >= 0;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatCard label="総評価額" value={`¥${stats.totalValue.toLocaleString()}`} sub="" color="text-gray-900" />
      <StatCard label="総取得コスト" value={`¥${stats.totalCost.toLocaleString()}`} sub="" color="text-gray-900" />
      <StatCard
        label="含み損益"
        value={`${isPositive ? "+" : ""}¥${stats.totalProfitLoss.toLocaleString()}`}
        sub={`${isPositive ? "+" : ""}${stats.totalProfitLossPercent.toFixed(2)}%`}
        color={isPositive ? "text-green-600" : "text-red-600"}
      />
      <StatCard
        label="損益率"
        value={`${isPositive ? "+" : ""}${stats.totalProfitLossPercent.toFixed(2)}%`}
        sub={isPositive ? "利益" : "損失"}
        color={isPositive ? "text-green-600" : "text-red-600"}
      />
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      {sub && <p className={`text-xs mt-0.5 ${color}`}>{sub}</p>}
    </div>
  );
}
```

- [ ] **Step 3: HoldingModal.tsx を作成する（fetch を services に置き換え）**

```typescript
// src/features/portfolio/components/HoldingModal.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Holding, StockSearchResult } from "@/types";
import { searchStocksByQuery, fetchStockQuote } from "@/services/stocksApi";

interface Props {
  holding?: Holding | null;
  onSave: (holding: Omit<Holding, "id"> & { id?: string }) => void;
  onClose: () => void;
}

const SECTORS = [
  "テクノロジー", "金融", "ヘルスケア", "消費財", "エネルギー",
  "素材", "不動産", "通信", "公益事業", "資本財", "その他",
];

export default function HoldingModal({ holding, onSave, onClose }: Props) {
  const [form, setForm] = useState({
    name: "", ticker: "", quantity: "", purchasePrice: "",
    currentPrice: "", sector: "テクノロジー",
    per: "", pbr: "", dividendYield: "", marketCap: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [fetchingQuote, setFetchingQuote] = useState(false);

  useEffect(() => {
    if (holding) {
      setForm({
        name: holding.name,
        ticker: holding.ticker,
        quantity: String(holding.quantity),
        purchasePrice: String(holding.purchasePrice),
        currentPrice: String(holding.currentPrice),
        sector: holding.sector,
        per: holding.per != null ? String(holding.per) : "",
        pbr: holding.pbr != null ? String(holding.pbr) : "",
        dividendYield: holding.dividendYield != null ? String(holding.dividendYield) : "",
        marketCap: holding.marketCap != null ? String(holding.marketCap) : "",
      });
      setSearchQuery(holding.ticker);
    }
  }, [holding]);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 1) { setSearchResults([]); return; }
    setSearching(true);
    try {
      setSearchResults(await searchStocksByQuery(q));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery, doSearch]);

  async function selectStock(s: StockSearchResult) {
    setSearchResults([]);
    setSearchQuery(s.ticker);
    setFetchingQuote(true);
    try {
      const q = await fetchStockQuote(s.ticker);
      setForm((prev) => ({
        ...prev,
        name: q.name ?? s.name,
        ticker: s.ticker,
        currentPrice: q.currentPrice ? String(q.currentPrice) : prev.currentPrice,
        per: q.per != null ? String(q.per.toFixed(2)) : "",
        pbr: q.pbr != null ? String(q.pbr.toFixed(2)) : "",
        dividendYield: q.dividendYield != null ? String(q.dividendYield.toFixed(2)) : "",
        marketCap: q.marketCap != null ? String(q.marketCap) : "",
      }));
    } finally {
      setFetchingQuote(false);
    }
  }

  async function refreshPrice() {
    if (!form.ticker) return;
    setFetchingQuote(true);
    try {
      const q = await fetchStockQuote(form.ticker);
      if (q.currentPrice) setForm((prev) => ({ ...prev, currentPrice: String(q.currentPrice) }));
    } finally {
      setFetchingQuote(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      id: holding?.id,
      name: form.name.trim(),
      ticker: form.ticker.trim().toUpperCase(),
      quantity: parseFloat(form.quantity),
      purchasePrice: parseFloat(form.purchasePrice),
      currentPrice: parseFloat(form.currentPrice),
      sector: form.sector,
      per: form.per ? parseFloat(form.per) : null,
      pbr: form.pbr ? parseFloat(form.pbr) : null,
      dividendYield: form.dividendYield ? parseFloat(form.dividendYield) : null,
      marketCap: form.marketCap ? parseFloat(form.marketCap) : null,
    });
  }

  const set = (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 my-4">
        <h2 className="text-lg font-bold mb-5">{holding ? "銘柄を編集" : "銘柄を追加"}</h2>

        <div className="mb-4 relative">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            銘柄検索 <span className="text-gray-400">(ティッカーまたは銘柄名)</span>
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="例: AAPL, 7203, トヨタ"
            className="input w-full"
          />
          {searching && <p className="text-xs text-gray-400 mt-1">検索中...</p>}
          {searchResults.length > 0 && (
            <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 overflow-hidden">
              {searchResults.map((r) => (
                <button
                  key={r.ticker}
                  type="button"
                  onClick={() => selectStock(r)}
                  className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 text-sm border-b border-gray-100 last:border-0"
                >
                  <span className="font-medium text-indigo-700">{r.ticker}</span>
                  <span className="text-gray-600 ml-2">{r.name}</span>
                  <span className="text-gray-400 text-xs ml-1">({r.exchange})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="銘柄名" required>
              <input type="text" value={form.name} onChange={set("name")} placeholder="例: Apple Inc." required className="input" />
            </Field>
            <Field label="ティッカー" required>
              <input type="text" value={form.ticker} onChange={set("ticker")} placeholder="例: AAPL" required className="input" />
            </Field>
          </div>
          <Field label="セクター" required>
            <select value={form.sector} onChange={set("sector")} className="input">
              {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="保有数" required>
              <input type="number" value={form.quantity} onChange={set("quantity")} placeholder="100" min="0" step="any" required className="input" />
            </Field>
            <Field label="購入単価 (¥)" required>
              <input type="number" value={form.purchasePrice} onChange={set("purchasePrice")} placeholder="150" min="0" step="any" required className="input" />
            </Field>
            <Field label="現在値 (¥)">
              <div className="flex gap-1">
                <input type="number" value={form.currentPrice} onChange={set("currentPrice")} placeholder="155" min="0" step="any" required className="input flex-1 min-w-0" />
                <button type="button" onClick={refreshPrice} disabled={fetchingQuote || !form.ticker} className="px-2 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs disabled:opacity-40" title="最新価格を取得">
                  {fetchingQuote ? "…" : "↻"}
                </button>
              </div>
            </Field>
          </div>
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-medium text-gray-500 mb-2">財務指標 (任意)</p>
            <div className="grid grid-cols-4 gap-2">
              <Field label="PER"><input type="number" value={form.per} onChange={set("per")} placeholder="15.0" step="any" className="input" /></Field>
              <Field label="PBR"><input type="number" value={form.pbr} onChange={set("pbr")} placeholder="2.0" step="any" className="input" /></Field>
              <Field label="配当利回り%"><input type="number" value={form.dividendYield} onChange={set("dividendYield")} placeholder="2.5" step="any" className="input" /></Field>
              <Field label="時価総額"><input type="number" value={form.marketCap} onChange={set("marketCap")} placeholder="3T" step="any" className="input" /></Field>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50">
              キャンセル
            </button>
            <button type="submit" className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-indigo-700">
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

- [ ] **Step 4: TypeScript チェック**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: コミット**

```bash
git add src/features/portfolio/
git commit -m "feat: move portfolio components to features/, replace fetch with services"
```

---

## Task 6: AI advice フックを作成してコンポーネントを移動する

**Files:**
- Create: `src/features/ai-advice/hooks/useAIChat.ts`
- Create: `src/features/ai-advice/components/AIAdviceChat.tsx`

- [ ] **Step 1: useAIChat.ts を作成する**

```typescript
// src/features/ai-advice/hooks/useAIChat.ts
import { useState } from "react";
import { ChatMessage, Holding } from "@/types";
import { streamAIAdvice } from "@/services/aiApi";

export function useAIChat(holdings: Holding[]) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);

    try {
      const reader = await streamAIAdvice(history, holdings);
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: accumulated };
          return updated;
        });
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "エラーが発生しました。もう一度お試しください。",
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  return { messages, input, setInput, send, loading };
}
```

- [ ] **Step 2: AIAdviceChat.tsx を作成する（fetch を useAIChat に置き換え）**

```typescript
// src/features/ai-advice/components/AIAdviceChat.tsx
"use client";

import { useRef, useEffect } from "react";
import { Holding } from "@/types";
import { useAIChat } from "../hooks/useAIChat";

interface Props {
  holdings: Holding[];
}

const SUGGESTIONS = [
  "現在のポートフォリオのリスク分析をしてください",
  "分散投資のアドバイスをお願いします",
  "含み損の銘柄はどうすればよいですか？",
  "長期投資の戦略を教えてください",
];

export default function AIAdviceChat({ holdings }: Props) {
  const { messages, input, setInput, send, loading } = useAIChat(holdings);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-[500px]">
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
        {messages.length === 0 ? (
          <div>
            <p className="text-sm text-gray-500 mb-3">AIアドバイザーにポートフォリオについて質問できます。</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="text-left text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg px-3 py-2 border border-indigo-100 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  msg.role === "user" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-800"
                }`}
              >
                {msg.content || (
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce delay-0">●</span>
                    <span className="animate-bounce delay-100">●</span>
                    <span className="animate-bounce delay-200">●</span>
                  </span>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 border-t border-gray-100 pt-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="投資について質問する..."
          disabled={loading}
          className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
        >
          送信
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript チェック**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: コミット**

```bash
git add src/features/ai-advice/
git commit -m "feat: extract useAIChat hook, move AIAdviceChat to features/"
```

---

## Task 7: screening フックを作成してコンポーネントを移動する

**Files:**
- Create: `src/features/screening/hooks/useScreening.ts`
- Create: `src/features/screening/hooks/useStockSync.ts`
- Create: `src/features/screening/components/StockScreening.tsx`

- [ ] **Step 1: useScreening.ts を作成する**

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
}

const INITIAL_CRITERIA: Criteria = {
  q: "", sector: "", market: "",
  perMax: "", pbrMax: "", dyMin: "",
  marketCapMin: "", marketCapMax: "",
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

- [ ] **Step 2: useStockSync.ts を作成する**

```typescript
// src/features/screening/hooks/useStockSync.ts
import { useState, useRef } from "react";
import { seedNikkei225, getSyncCount, syncStocks, importStocksCsv } from "@/services/stocksApi";

interface SyncState {
  jobId?: string;
  running: boolean;
  processed: number;
  total: number;
  failed: number;
  done: boolean;
}

const INITIAL_SYNC: SyncState = { running: false, processed: 0, total: 0, failed: 0, done: false };

export function useStockSync() {
  const [sync, setSync] = useState<SyncState>(INITIAL_SYNC);
  const [seeding, setSeeding] = useState(false);
  const [seedDone, setSeedDone] = useState(false);
  const [importing, setImporting] = useState(false);
  const syncRef = useRef(false);

  async function seed() {
    setSeeding(true);
    try {
      const d = await seedNikkei225();
      setSeedDone(true);
      alert(`日経225 ${d.seeded}銘柄をDBに登録しました。`);
    } finally {
      setSeeding(false);
    }
  }

  async function start() {
    if (syncRef.current) return;
    syncRef.current = true;

    const countData = await getSyncCount();
    let jobId: string | undefined = undefined;
    setSync({ running: true, processed: 0, total: countData.total ?? 0, failed: 0, done: false });

    while (syncRef.current) {
      const data = await syncStocks(jobId);
      jobId = data.jobId;
      setSync({
        running: !data.done,
        jobId,
        processed: data.processed ?? 0,
        total: data.total ?? 0,
        failed: data.failed ?? 0,
        done: data.done,
      });
      if (data.done) { syncRef.current = false; break; }
    }
  }

  function stop() {
    syncRef.current = false;
    setSync((p) => ({ ...p, running: false }));
  }

  async function importCsv(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const d = await importStocksCsv(text);
      if (d.error) alert(d.error);
      else alert(`${d.imported}銘柄を取り込みました。`);
    } finally {
      setImporting(false);
    }
  }

  return { sync, start, stop, seeding, seedDone, seed, importing, importCsv };
}
```

- [ ] **Step 3: StockScreening.tsx を作成する（フックを使う版）**

```typescript
// src/features/screening/components/StockScreening.tsx
"use client";

import { useRef } from "react";
import { useScreening } from "../hooks/useScreening";
import { useStockSync } from "../hooks/useStockSync";

const SECTORS = [
  "", "水産・農林", "鉱業", "建設", "食品", "繊維", "パルプ・紙", "化学",
  "医薬品", "石油・石炭", "ゴム", "ガラス・土石", "鉄鋼", "非鉄金属",
  "機械", "電機", "輸送用機器", "精密機器", "商社", "小売", "銀行",
  "証券・商品先物", "保険", "その他金融", "不動産", "陸運", "海運",
  "空運", "倉庫・運輸", "情報・通信", "電力・ガス", "サービス", "その他",
];

const MARKETS = ["", "プライム", "スタンダード", "グロース"];

export default function StockScreening() {
  const { criteria, set, results, searching, screen, reset } = useScreening();
  const { sync, start, stop, seeding, seedDone, seed, importing, importCsv } = useStockSync();
  const fileRef = useRef<HTMLInputElement>(null);

  const syncPct = sync.total > 0 ? Math.round((sync.processed / sync.total) * 100) : 0;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    importCsv(file).finally(() => { if (fileRef.current) fileRef.current.value = ""; });
  }

  return (
    <div className="space-y-5">
      {/* データ準備 */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <p className="text-sm font-medium text-gray-700">① データ準備</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={seed} disabled={seeding} className="text-sm px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            {seeding ? "登録中..." : seedDone ? "✓ 日経225登録済み" : "日経225をDBに登録 (225銘柄)"}
          </button>
          <label className={`text-sm px-4 py-2 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 ${importing ? "opacity-50" : ""}`}>
            {importing ? "取込中..." : "JPX CSVを取り込む"}
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileChange} className="hidden" disabled={importing} />
          </label>
          <a href="https://www.jpx.co.jp/markets/statistics-equities/misc/01.html" target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline self-center">
            JPX 上場銘柄一覧 →
          </a>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">② Yahoo Finance から財務指標を同期</p>
          <div className="flex items-center gap-3">
            {!sync.running ? (
              <button onClick={start} disabled={sync.done} className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {sync.done ? "同期完了" : "同期開始"}
              </button>
            ) : (
              <button onClick={stop} className="text-sm px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">停止</button>
            )}
            {(sync.running || sync.done || sync.processed > 0) && (
              <div className="flex-1 space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{sync.processed}/{sync.total > 0 ? sync.total : "?"}件処理済み</span>
                  {sync.failed > 0 && <span className="text-red-400">失敗: {sync.failed}件</span>}
                  <span>{syncPct}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${sync.done ? "bg-green-500" : "bg-indigo-500"}`} style={{ width: `${syncPct}%` }} />
                </div>
                <p className="text-xs text-gray-400">{sync.running ? "10件/バッチ、200ms間隔で取得中..." : sync.done ? "同期完了" : "停止中"}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* スクリーニング条件 */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700">③ スクリーニング条件</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">銘柄名・ティッカー</label>
            <input type="text" value={criteria.q} onChange={set("q")} placeholder="例: トヨタ, 7203" className="input w-full" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">セクター</label>
            <select value={criteria.sector} onChange={set("sector")} className="input w-full">
              {SECTORS.map((s) => <option key={s} value={s}>{s || "すべて"}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">市場</label>
            <select value={criteria.market} onChange={set("market")} className="input w-full">
              {MARKETS.map((m) => <option key={m} value={m}>{m || "すべて"}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">PER 以下</label>
            <input type="number" value={criteria.perMax} onChange={set("perMax")} placeholder="例: 20" step="any" className="input w-full" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">PBR 以下</label>
            <input type="number" value={criteria.pbrMax} onChange={set("pbrMax")} placeholder="例: 2" step="any" className="input w-full" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">配当利回り% 以上</label>
            <input type="number" value={criteria.dyMin} onChange={set("dyMin")} placeholder="例: 3" step="any" className="input w-full" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">時価総額 下限(億円)</label>
            <input type="number" value={criteria.marketCapMin} onChange={set("marketCapMin")} placeholder="例: 1000" step="any" className="input w-full" />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={screen} disabled={searching} className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {searching ? "検索中..." : "スクリーニング実行"}
          </button>
          <button onClick={reset} className="px-5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50">
            リセット
          </button>
        </div>
      </div>

      {/* 結果テーブル */}
      {results !== null && (
        <div>
          <p className="text-sm text-gray-500 mb-3">結果: <span className="font-medium text-gray-800">{results.length}件</span></p>
          {results.length === 0 ? (
            <p className="text-center text-gray-400 py-8">条件に一致する銘柄がありません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 text-left">
                    <th className="pb-2 pr-3 font-medium">ティッカー</th>
                    <th className="pb-2 pr-3 font-medium">銘柄名</th>
                    <th className="pb-2 pr-3 font-medium">セクター</th>
                    <th className="pb-2 pr-3 font-medium text-right">現在値</th>
                    <th className="pb-2 pr-3 font-medium text-right">PER</th>
                    <th className="pb-2 pr-3 font-medium text-right">PBR</th>
                    <th className="pb-2 pr-3 font-medium text-right">配当%</th>
                    <th className="pb-2 font-medium text-right">時価総額</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((s) => (
                    <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 pr-3 font-mono text-indigo-600 text-xs">{s.ticker}</td>
                      <td className="py-2 pr-3 font-medium">{s.name}</td>
                      <td className="py-2 pr-3 text-gray-500 text-xs">{s.sector ?? "-"}</td>
                      <td className="py-2 pr-3 text-right">{s.currentPrice != null ? `¥${s.currentPrice.toLocaleString()}` : "-"}</td>
                      <td className="py-2 pr-3 text-right">{s.per != null ? s.per.toFixed(1) : "-"}</td>
                      <td className="py-2 pr-3 text-right">{s.pbr != null ? s.pbr.toFixed(2) : "-"}</td>
                      <td className="py-2 pr-3 text-right">{s.dividendYield != null ? `${s.dividendYield.toFixed(2)}%` : "-"}</td>
                      <td className="py-2 text-right text-xs text-gray-500">{s.marketCap != null ? `${(s.marketCap / 1e8).toFixed(0)}億` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .input { border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px 12px; font-size: 14px; outline: none; }
        .input:focus { box-shadow: 0 0 0 3px rgba(99,102,241,0.2); border-color: #6366f1; }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 4: TypeScript チェック**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: コミット**

```bash
git add src/features/screening/
git commit -m "feat: extract useScreening and useStockSync hooks, move StockScreening to features/"
```

---

## Task 8: PortfolioChart を features/ へ移動する

**Files:**
- Create: `src/features/charts/components/PortfolioChart.tsx`

- [ ] **Step 1: features/charts/components/PortfolioChart.tsx を作成する**

```typescript
// src/features/charts/components/PortfolioChart.tsx
"use client";

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Holding } from "@/types";

interface Props {
  holdings: Holding[];
}

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#14b8a6"];

export default function PortfolioChart({ holdings }: Props) {
  if (holdings.length === 0) {
    return <div className="text-center py-12 text-gray-400"><p>銘柄を追加するとチャートが表示されます</p></div>;
  }

  const pieData = holdings.map((h) => ({ name: h.ticker, value: h.currentPrice * h.quantity }));
  const barData = holdings.map((h) => ({
    name: h.ticker,
    損益: parseFloat(((h.currentPrice - h.purchasePrice) * h.quantity).toFixed(0)),
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <h3 className="text-sm font-medium text-gray-600 mb-3">資産配分</h3>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={100} paddingAngle={3} dataKey="value">
              {pieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(value) => [`¥${Number(value).toLocaleString()}`, "評価額"]} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-600 mb-3">銘柄別損益</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={barData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <Tooltip formatter={(value) => [`¥${Number(value).toLocaleString()}`, "損益"]} />
            <Bar dataKey="損益" radius={[4, 4, 0, 0]} fill="#6366f1">
              {barData.map((entry, index) => <Cell key={`bar-${index}`} fill={entry.損益 >= 0 ? "#10b981" : "#ef4444"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript チェック**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: コミット**

```bash
git add src/features/charts/
git commit -m "feat: move PortfolioChart to features/charts/"
```

---

## Task 9: page.tsx をスリム化する

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: page.tsx を書き換える**

```typescript
// src/app/page.tsx
"use client";

import { useState } from "react";
import { useHoldings } from "@/features/portfolio/hooks/useHoldings";
import { usePortfolioStats } from "@/features/portfolio/hooks/usePortfolioStats";
import ProfitLossCard from "@/features/portfolio/components/ProfitLossCard";
import PortfolioTable from "@/features/portfolio/components/PortfolioTable";
import HoldingModal from "@/features/portfolio/components/HoldingModal";
import PortfolioChart from "@/features/charts/components/PortfolioChart";
import StockScreening from "@/features/screening/components/StockScreening";
import AIAdviceChat from "@/features/ai-advice/components/AIAdviceChat";
import { Holding } from "@/types";

type Tab = "portfolio" | "chart" | "screening" | "ai";

const SECTORS = [
  "", "テクノロジー", "金融", "ヘルスケア", "消費財", "エネルギー",
  "素材", "不動産", "通信", "公益事業", "資本財", "その他",
];

const TAB_LABELS: Record<Tab, string> = {
  portfolio: "ポートフォリオ",
  chart: "チャート",
  screening: "スクリーニング",
  ai: "AIアドバイス",
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("portfolio");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);

  const {
    holdings,
    allHoldings,
    loading,
    searchQuery, setSearchQuery,
    sectorFilter, setSectorFilter,
    save,
    remove,
  } = useHoldings();

  const stats = usePortfolioStats(allHoldings);

  function handleEdit(holding: Holding) {
    setEditingHolding(holding);
    setModalOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("この銘柄を削除しますか？")) return;
    await remove(id);
  }

  async function handleSave(data: Omit<Holding, "id"> & { id?: string }) {
    await save(data);
    setModalOpen(false);
    setEditingHolding(null);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">投資管理アプリ</h1>
            <p className="text-xs text-gray-500 mt-0.5">AI搭載ポートフォリオマネージャー</p>
          </div>
          <button
            onClick={() => { setEditingHolding(null); setModalOpen(true); }}
            className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors"
          >
            + 銘柄を追加
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <ProfitLossCard stats={stats} />

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-100 overflow-x-auto">
            {(["portfolio", "chart", "screening", "ai"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 min-w-max py-3.5 px-4 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>

          {activeTab === "portfolio" && (
            <div className="flex gap-2 px-6 pt-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="銘柄名・ティッカーで検索..."
                className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <select
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {SECTORS.map((s) => <option key={s} value={s}>{s || "全セクター"}</option>)}
              </select>
            </div>
          )}

          <div className="p-6">
            {loading ? (
              <p className="text-center text-gray-400 py-8">読み込み中...</p>
            ) : (
              <>
                {activeTab === "portfolio" && (
                  <PortfolioTable holdings={holdings} onEdit={handleEdit} onDelete={handleDelete} />
                )}
                {activeTab === "chart" && <PortfolioChart holdings={allHoldings} />}
                {activeTab === "screening" && <StockScreening />}
                {activeTab === "ai" && <AIAdviceChat holdings={allHoldings} />}
              </>
            )}
          </div>
        </div>

        <p className="text-xs text-center text-gray-400">
          ※ このアプリは教育目的です。投資判断はご自身の責任で行ってください。
        </p>
      </main>

      {modalOpen && (
        <HoldingModal
          holding={editingHolding}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditingHolding(null); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript チェック**

```bash
npx tsc --noEmit
```

エラーがないことを確認する。

- [ ] **Step 3: コミット**

```bash
git add src/app/page.tsx
git commit -m "refactor: slim down page.tsx to use hooks and features/ imports"
```

---

## Task 10: 旧ファイルを削除してクリーンアップする

**Files:**
- Delete: `src/components/PortfolioTable.tsx`
- Delete: `src/components/ProfitLossCard.tsx`
- Delete: `src/components/HoldingModal.tsx`
- Delete: `src/components/AIAdviceChat.tsx`
- Delete: `src/components/StockScreening.tsx`
- Delete: `src/components/PortfolioChart.tsx`
- Delete: `src/components/ScreeningPanel.tsx`
- Delete: `src/components/` (空になったら)

- [ ] **Step 1: 旧コンポーネントを削除する**

```bash
rm src/components/PortfolioTable.tsx
rm src/components/ProfitLossCard.tsx
rm src/components/HoldingModal.tsx
rm src/components/AIAdviceChat.tsx
rm src/components/StockScreening.tsx
rm src/components/PortfolioChart.tsx
rm src/components/ScreeningPanel.tsx
rmdir src/components
```

- [ ] **Step 2: TypeScript チェックとビルド確認**

```bash
npx tsc --noEmit
```

エラーが0件であることを確認する。

- [ ] **Step 3: 開発サーバーで動作確認**

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開き、以下を確認する：
- ポートフォリオタブ：保有銘柄の表示・追加・編集・削除が動作する
- チャートタブ：グラフが表示される
- スクリーニングタブ：スクリーニング実行・同期開始・停止が動作する
- AIアドバイスタブ：メッセージ送信とストリーミング応答が動作する
- `page.tsx` の行数が50行以下であることを確認する

- [ ] **Step 4: 最終コミット**

```bash
git add -A
git commit -m "chore: remove old src/components/ after migration to features/"
```

---

## 成功基準チェックリスト

- [ ] `src/app/page.tsx` が50行以下
- [ ] `src/components/` ディレクトリが存在しない
- [ ] 各コンポーネントが直接 `fetch` を呼ばない（services 経由のみ）
- [ ] 各フックが単一ドメインに閉じている
- [ ] `npx tsc --noEmit` がエラー0件
- [ ] 全4タブが開発サーバーで正常動作する
