# UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ダークモダンなダッシュボード型UIに全面刷新し、サイドバーナビゲーション・KPI重視の概要画面・バックグラウンド自動同期を実装する。

**Architecture:** `AppShell`（クライアントコンポーネント）がサイドバー・ヘッダー・自動同期を担い、App Router の各ページ（`/`, `/portfolio`, `/stocks`, `/charts`）をラップする。AI FAB は全ページ共通のフローティングコンポーネントとして AppShell 内に配置する。

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS 4, recharts, CSS Custom Properties（ダークテーマ管理）

---

## ファイルマップ

| 操作 | パス |
|------|------|
| 更新 | `src/app/globals.css` |
| 更新 | `src/app/layout.tsx` |
| 新規 | `src/hooks/useAutoSync.ts` |
| 新規 | `src/components/AppShell.tsx` |
| 更新 | `src/app/page.tsx`（概要ページに書き換え） |
| 新規 | `src/app/portfolio/page.tsx` |
| 更新 | `src/features/portfolio/components/PortfolioTable.tsx` |
| 新規 | `src/app/stocks/page.tsx` |
| 更新 | `src/features/screening/components/StockScreening.tsx` |
| 更新 | `src/features/portfolio/components/HoldingModal.tsx` |
| 新規 | `src/app/charts/page.tsx` |
| 更新 | `src/features/charts/components/PortfolioChart.tsx` |
| 新規 | `src/components/AIFloatingButton.tsx` |

**変更しないもの:** `src/app/api/`, `prisma/`, `src/services/`, `src/types/`, フックファイル群（useHoldings等）

---

## Task 1: ダークテーマ（globals.css + layout.tsx）

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: globals.css をダークテーマに書き換える**

```css
/* src/app/globals.css */
@import "tailwindcss";

:root {
  --bg-page: #0f1117;
  --bg-sidebar: #1a1d27;
  --bg-card: #1e2130;
  --border-card: #2a2d3e;
  --text-main: #e2e8f0;
  --text-sub: #94a3b8;
  --accent: #6366f1;
  --up: #22c55e;
  --down: #ef4444;
  --background: #0f1117;
  --foreground: #e2e8f0;
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--bg-page);
  color: var(--text-main);
  font-family: var(--font-sans), Arial, Helvetica, sans-serif;
}

* {
  box-sizing: border-box;
}
```

- [ ] **Step 2: layout.tsx を書き換える**

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "投資管理アプリ",
  description: "AI搭載ポートフォリオマネージャー",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: TypeScript チェック（AppShell がまだないためエラーが出ることを確認）**

```bash
npx tsc --noEmit 2>&1 | head -5
```

Expected: `AppShell` が見つからないエラー（Task 3 で解消する）。

- [ ] **Step 4: コミット**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat: add dark theme CSS variables and prepare layout for AppShell"
```

---

## Task 2: useAutoSync フックを作成する

**Files:**
- Create: `src/hooks/useAutoSync.ts`

- [ ] **Step 1: フックを作成する**

```typescript
// src/hooks/useAutoSync.ts
import { useState, useEffect, useCallback } from "react";
import { getSyncCount, syncStocks } from "@/services/stocksApi";

export interface SyncProgress {
  processed: number;
  total: number;
}

export function useAutoSync() {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress>({ processed: 0, total: 0 });

  const runSync = useCallback(async () => {
    try {
      const { total } = await getSyncCount();
      if (total === 0) return;

      setSyncing(true);
      setProgress({ processed: 0, total });

      let jobId: string | undefined;
      while (true) {
        const data = await syncStocks(jobId);
        jobId = data.jobId;
        setProgress({ processed: data.processed, total: data.total || total });
        if (data.done) break;
      }
    } catch {
      // エラー時は静かに停止
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    runSync();
  }, [runSync]);

  return { syncing, progress };
}
```

- [ ] **Step 2: TypeScript チェック**

```bash
npx tsc --noEmit 2>&1 | grep "useAutoSync" | head -5
```

Expected: `useAutoSync` 関連のエラーなし。

- [ ] **Step 3: コミット**

```bash
git add src/hooks/useAutoSync.ts
git commit -m "feat: add useAutoSync hook for background stock sync on app start"
```

---

## Task 3: AppShell コンポーネントを作成する

**Files:**
- Create: `src/components/AppShell.tsx`

- [ ] **Step 1: AppShell.tsx を作成する**

```tsx
// src/components/AppShell.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAutoSync } from "@/hooks/useAutoSync";
import AIFloatingButton from "@/components/AIFloatingButton";

const NAV_ITEMS = [
  { href: "/", label: "概要", icon: "📊" },
  { href: "/portfolio", label: "保有一覧", icon: "📋" },
  { href: "/stocks", label: "銘柄DB", icon: "🔍" },
  { href: "/charts", label: "チャート", icon: "📈" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { syncing, progress } = useAutoSync();

  return (
    <div className="flex flex-col h-screen" style={{ background: "var(--bg-page)" }}>
      {/* Header */}
      <header
        className="h-14 flex items-center px-6 flex-shrink-0 gap-4"
        style={{ background: "var(--bg-sidebar)", borderBottom: "1px solid var(--border-card)" }}
      >
        <span className="font-bold text-white flex-1 text-base">▋ 投資管理</span>
        {syncing && (
          <span className="text-xs flex items-center gap-1.5" style={{ color: "var(--text-sub)" }}>
            <span className="inline-block animate-spin">⟳</span>
            同期中 {progress.processed}/{progress.total}
          </span>
        )}
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

**注意:** `AIFloatingButton` は Task 9 で作成する。Task 3 のコミット前に一時的なプレースホルダーを作成する。

- [ ] **Step 2: AIFloatingButton のプレースホルダーを作成する**

```tsx
// src/components/AIFloatingButton.tsx（プレースホルダー）
"use client";

export default function AIFloatingButton() {
  return null;
}
```

- [ ] **Step 3: TypeScript チェック**

```bash
npx tsc --noEmit
```

Expected: エラー0件。

- [ ] **Step 4: コミット**

```bash
git add src/components/AppShell.tsx src/components/AIFloatingButton.tsx
git commit -m "feat: add AppShell with sidebar, header, and auto-sync status"
```

---

## Task 4: 概要ページを作成する（page.tsx の書き換え）

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: page.tsx を概要ダッシュボードに書き換える**

```tsx
// src/app/page.tsx
"use client";

import { useMemo } from "react";
import Link from "next/link";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useHoldings } from "@/features/portfolio/hooks/useHoldings";
import { usePortfolioStats } from "@/features/portfolio/hooks/usePortfolioStats";

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#14b8a6"];

export default function OverviewPage() {
  const { allHoldings, loading } = useHoldings();
  const stats = usePortfolioStats(allHoldings);

  const ranked = useMemo(() =>
    [...allHoldings]
      .map((h) => ({
        ...h,
        pl: (h.currentPrice - h.purchasePrice) * h.quantity,
        plPct: ((h.currentPrice - h.purchasePrice) / h.purchasePrice) * 100,
      }))
      .sort((a, b) => b.pl - a.pl)
      .slice(0, 5),
    [allHoldings]
  );

  const pieData = useMemo(() =>
    allHoldings.map((h) => ({ name: h.ticker, value: h.currentPrice * h.quantity })),
    [allHoldings]
  );

  const isPositive = stats.totalProfitLoss >= 0;
  const plColor = isPositive ? "var(--up)" : "var(--down)";

  if (loading) {
    return <p className="text-center py-20" style={{ color: "var(--text-sub)" }}>読み込み中...</p>;
  }

  // オンボーディングバナー（保有0件の場合）
  if (allHoldings.length === 0) {
    return (
      <div className="max-w-2xl mx-auto mt-16">
        <div
          className="rounded-2xl p-8 border"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-card)" }}
        >
          <h2 className="text-xl font-bold text-white mb-2">ようこそ！まず銘柄を登録してみましょう</h2>
          <p className="text-sm mb-6" style={{ color: "var(--text-sub)" }}>
            投資管理を始めるには、以下の手順で銘柄を登録してください。
          </p>
          <ol className="space-y-3 mb-8">
            {[
              "銘柄DBで日経225をワンクリック登録",
              "スクリーニングで投資したい銘柄を探す",
              "保有一覧から購入済み銘柄を追加する",
            ].map((step, i) => (
              <li key={i} className="flex items-center gap-3 text-sm" style={{ color: "var(--text-main)" }}>
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: "var(--accent)", color: "white" }}
                >
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <Link
            href="/stocks"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-colors hover:opacity-90"
            style={{ background: "var(--accent)" }}
          >
            銘柄DBへ →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI バー */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "総評価額", value: `¥${stats.totalValue.toLocaleString()}`, color: "var(--text-main)" },
          { label: "含み損益", value: `${isPositive ? "+" : ""}¥${stats.totalProfitLoss.toLocaleString()}`, color: plColor },
          { label: "損益率", value: `${isPositive ? "+" : ""}${stats.totalProfitLossPercent.toFixed(2)}%`, color: plColor },
          { label: "保有銘柄数", value: `${allHoldings.length}銘柄`, color: "var(--text-sub)" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border p-5"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-card)" }}
          >
            <p className="text-xs mb-1" style={{ color: "var(--text-sub)" }}>{kpi.label}</p>
            <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* メインコンテンツ */}
      <div className="grid grid-cols-2 gap-4">
        {/* 資産配分 Pie */}
        <div
          className="rounded-xl border p-5"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-card)" }}
        >
          <h3 className="text-sm font-medium mb-4" style={{ color: "var(--text-sub)" }}>資産配分</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => [`¥${Number(v).toLocaleString()}`, "評価額"]} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 損益ランキング */}
        <div
          className="rounded-xl border p-5"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-card)" }}
        >
          <h3 className="text-sm font-medium mb-4" style={{ color: "var(--text-sub)" }}>損益ランキング</h3>
          <div className="space-y-3">
            {ranked.map((h, i) => (
              <div key={h.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs w-4" style={{ color: "var(--text-sub)" }}>{i + 1}</span>
                  <div>
                    <span className="text-sm font-medium" style={{ color: "var(--text-main)" }}>{h.name}</span>
                    <span className="text-xs ml-1.5" style={{ color: "var(--text-sub)" }}>{h.ticker}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium" style={{ color: h.pl >= 0 ? "var(--up)" : "var(--down)" }}>
                    {h.pl >= 0 ? "+" : ""}¥{h.pl.toLocaleString()}
                  </div>
                  <div className="text-xs" style={{ color: h.plPct >= 0 ? "var(--up)" : "var(--down)" }}>
                    {h.plPct >= 0 ? "+" : ""}{h.plPct.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 保有プレビュー（上位5件） */}
      <div
        className="rounded-xl border"
        style={{ background: "var(--bg-card)", borderColor: "var(--border-card)" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border-card)" }}>
          <h3 className="text-sm font-medium" style={{ color: "var(--text-sub)" }}>保有一覧（上位5件）</h3>
          <Link href="/portfolio" className="text-xs hover:underline" style={{ color: "var(--accent)" }}>
            すべて見る →
          </Link>
        </div>
        <div className="p-5">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "var(--text-sub)" }}>
                <th className="text-left pb-2 font-medium">銘柄</th>
                <th className="text-right pb-2 font-medium">評価額</th>
                <th className="text-right pb-2 font-medium">損益</th>
                <th className="text-right pb-2 font-medium">損益率</th>
              </tr>
            </thead>
            <tbody>
              {allHoldings.slice(0, 5).map((h) => {
                const v = h.currentPrice * h.quantity;
                const pl = v - h.purchasePrice * h.quantity;
                const plPct = ((h.currentPrice - h.purchasePrice) / h.purchasePrice) * 100;
                const c = pl >= 0 ? "var(--up)" : "var(--down)";
                return (
                  <tr key={h.id} className="border-t" style={{ borderColor: "var(--border-card)" }}>
                    <td className="py-2.5">
                      <span className="font-medium" style={{ color: "var(--text-main)" }}>{h.name}</span>
                      <span className="text-xs ml-1.5" style={{ color: "var(--text-sub)" }}>{h.ticker}</span>
                    </td>
                    <td className="text-right py-2.5" style={{ color: "var(--text-main)" }}>¥{v.toLocaleString()}</td>
                    <td className="text-right py-2.5 font-medium" style={{ color: c }}>{pl >= 0 ? "+" : ""}¥{pl.toLocaleString()}</td>
                    <td className="text-right py-2.5 font-medium" style={{ color: c }}>{plPct >= 0 ? "+" : ""}{plPct.toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
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
git add src/app/page.tsx
git commit -m "feat: rewrite page.tsx as overview dashboard with KPI, pie chart, ranking"
```

---

## Task 5: 保有一覧ページを作成する

**Files:**
- Create: `src/app/portfolio/page.tsx`
- Modify: `src/features/portfolio/components/PortfolioTable.tsx`

- [ ] **Step 1: PortfolioTable.tsx を4列デザインに書き換える**

```tsx
// src/features/portfolio/components/PortfolioTable.tsx
"use client";

import { useState } from "react";
import { Holding } from "@/types";

interface Props {
  holdings: Holding[];
  onEdit: (holding: Holding) => void;
  onDelete: (id: string) => void;
}

export default function PortfolioTable({ holdings, onEdit, onDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  if (holdings.length === 0) {
    return (
      <div className="text-center py-16" style={{ color: "var(--text-sub)" }}>
        <p className="text-lg">保有銘柄がありません</p>
        <p className="text-sm mt-1">「銘柄を追加」から投資銘柄を登録してください</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b" style={{ borderColor: "var(--border-card)", color: "var(--text-sub)" }}>
            <th className="text-left pb-3 pr-4 font-medium">銘柄</th>
            <th className="text-right pb-3 pr-4 font-medium">評価額</th>
            <th className="text-right pb-3 pr-4 font-medium">損益</th>
            <th className="text-right pb-3 pr-4 font-medium">損益率</th>
            <th className="w-8 pb-3"></th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const value = h.currentPrice * h.quantity;
            const pl = value - h.purchasePrice * h.quantity;
            const plPct = ((h.currentPrice - h.purchasePrice) / h.purchasePrice) * 100;
            const plColor = pl >= 0 ? "var(--up)" : "var(--down)";
            const purchaseDateStr = h.purchaseDate
              ? new Date(h.purchaseDate).toLocaleDateString("ja-JP")
              : null;

            return (
              <tr
                key={h.id}
                className="border-b transition-opacity hover:opacity-80"
                style={{ borderColor: "var(--border-card)" }}
              >
                <td className="py-3 pr-4">
                  <div className="font-medium" style={{ color: "var(--text-main)" }}>{h.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-sub)" }}>
                    {h.ticker} · {h.quantity.toLocaleString()}株 @ ¥{h.purchasePrice.toLocaleString()}
                    {purchaseDateStr && ` · ${purchaseDateStr}`}
                  </div>
                </td>
                <td className="py-3 pr-4 text-right font-medium" style={{ color: "var(--text-main)" }}>
                  ¥{value.toLocaleString()}
                </td>
                <td className="py-3 pr-4 text-right font-medium" style={{ color: plColor }}>
                  {pl >= 0 ? "+" : ""}¥{pl.toLocaleString()}
                </td>
                <td className="py-3 pr-4 text-right font-medium" style={{ color: plColor }}>
                  {plPct >= 0 ? "+" : ""}{plPct.toFixed(2)}%
                </td>
                <td className="py-3 text-center relative">
                  <button
                    onClick={() => setMenuOpen(menuOpen === h.id ? null : h.id)}
                    className="px-2 py-1 rounded text-lg leading-none hover:bg-white/10 transition-colors"
                    style={{ color: "var(--text-sub)" }}
                  >
                    ⋯
                  </button>
                  {menuOpen === h.id && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setMenuOpen(null)}
                      />
                      <div
                        className="absolute right-0 top-8 z-20 rounded-lg shadow-xl border text-sm w-28"
                        style={{ background: "var(--bg-card)", borderColor: "var(--border-card)" }}
                      >
                        <button
                          onClick={() => { onEdit(h); setMenuOpen(null); }}
                          className="block w-full text-left px-4 py-2.5 hover:bg-white/5 rounded-t-lg transition-colors"
                          style={{ color: "var(--text-main)" }}
                        >
                          編集
                        </button>
                        <button
                          onClick={() => { onDelete(h.id); setMenuOpen(null); }}
                          className="block w-full text-left px-4 py-2.5 hover:bg-white/5 rounded-b-lg transition-colors"
                          style={{ color: "var(--down)" }}
                        >
                          削除
                        </button>
                      </div>
                    </>
                  )}
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

- [ ] **Step 2: src/app/portfolio/page.tsx を作成する**

```tsx
// src/app/portfolio/page.tsx
"use client";

import { useState } from "react";
import { useHoldings } from "@/features/portfolio/hooks/useHoldings";
import { usePortfolioStats } from "@/features/portfolio/hooks/usePortfolioStats";
import PortfolioTable from "@/features/portfolio/components/PortfolioTable";
import HoldingModal from "@/features/portfolio/components/HoldingModal";
import { Holding, HoldingSaveInput } from "@/types";

const SECTORS = [
  "", "テクノロジー", "金融", "ヘルスケア", "消費財", "エネルギー",
  "素材", "不動産", "通信", "公益事業", "資本財", "その他",
];

export default function PortfolioPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);

  const {
    holdings, allHoldings, loading,
    searchQuery, setSearchQuery,
    sectorFilter, setSectorFilter,
    save, remove,
  } = useHoldings();

  const stats = usePortfolioStats(allHoldings);

  async function handleSave(data: HoldingSaveInput) {
    await save(data);
    setModalOpen(false);
    setEditingHolding(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("この銘柄を削除しますか？")) return;
    await remove(id);
  }

  return (
    <div className="space-y-5">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: "var(--text-main)" }}>保有一覧</h1>
        <button
          onClick={() => { setEditingHolding(null); setModalOpen(true); }}
          className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors hover:opacity-90"
          style={{ background: "var(--accent)" }}
        >
          + 銘柄を追加
        </button>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "総評価額", value: `¥${stats.totalValue.toLocaleString()}`, color: "var(--text-main)" },
          {
            label: "含み損益",
            value: `${stats.totalProfitLoss >= 0 ? "+" : ""}¥${stats.totalProfitLoss.toLocaleString()}`,
            color: stats.totalProfitLoss >= 0 ? "var(--up)" : "var(--down)",
          },
          {
            label: "損益率",
            value: `${stats.totalProfitLossPercent >= 0 ? "+" : ""}${stats.totalProfitLossPercent.toFixed(2)}%`,
            color: stats.totalProfitLossPercent >= 0 ? "var(--up)" : "var(--down)",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border p-4"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-card)" }}
          >
            <p className="text-xs mb-1" style={{ color: "var(--text-sub)" }}>{s.label}</p>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* 検索・フィルター */}
      <div className="flex gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍  銘柄名・ティッカーで検索..."
          className="flex-1 text-sm px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-card)", color: "var(--text-main)" }}
        />
        <select
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
          className="text-sm px-3 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-card)", color: "var(--text-main)" }}
        >
          {SECTORS.map((s) => <option key={s} value={s}>{s || "全セクター"}</option>)}
        </select>
      </div>

      {/* テーブル */}
      <div
        className="rounded-xl border"
        style={{ background: "var(--bg-card)", borderColor: "var(--border-card)" }}
      >
        <div className="p-5">
          {loading ? (
            <p className="text-center py-8" style={{ color: "var(--text-sub)" }}>読み込み中...</p>
          ) : (
            <PortfolioTable
              holdings={holdings}
              onEdit={(h) => { setEditingHolding(h); setModalOpen(true); }}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>

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

- [ ] **Step 3: TypeScript チェック**

```bash
npx tsc --noEmit
```

Expected: エラー0件。

- [ ] **Step 4: コミット**

```bash
git add src/app/portfolio/page.tsx src/features/portfolio/components/PortfolioTable.tsx
git commit -m "feat: add portfolio page and update PortfolioTable to 4-column dark design"
```

---

## Task 6: 銘柄DBページを作成する

**Files:**
- Create: `src/app/stocks/page.tsx`
- Modify: `src/features/screening/components/StockScreening.tsx`
- Modify: `src/features/portfolio/components/HoldingModal.tsx`

- [ ] **Step 1: HoldingModal に initialStock prop を追加する**

`src/features/portfolio/components/HoldingModal.tsx` の `Props` インターフェースと `useEffect` を更新する：

```tsx
// Props を更新（既存コードの Props インターフェース部分を置き換え）
interface Props {
  holding?: Holding | null;
  initialStock?: Stock | null;   // ← 追加
  onSave: (data: HoldingSaveInput) => void;
  onClose: () => void;
}
```

`useEffect` の直後に initialStock 用の useEffect を追加する：

```tsx
// holding の useEffect の直後に追加
useEffect(() => {
  if (initialStock && !holding) {
    setSelectedStock(initialStock);
    setStockQuery(initialStock.ticker);
  }
}, [initialStock, holding]);
```

- [ ] **Step 2: StockScreening.tsx を書き換える（同期UIを削除、「追加+」を追加）**

```tsx
// src/features/screening/components/StockScreening.tsx
"use client";

import { useRef } from "react";
import { useScreening } from "../hooks/useScreening";
import { useStockSync } from "../hooks/useStockSync";
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
  const { seeding, seedDone, seed, importing, importCsv } = useStockSync();
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    importCsv(file).finally(() => { if (fileRef.current) fileRef.current.value = ""; });
  }

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
      {/* セットアップガイド（seedDone でない場合のみ表示） */}
      {!seedDone && results === null && (
        <div
          className="rounded-xl border p-5"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-card)" }}
        >
          <p className="text-sm font-medium mb-3" style={{ color: "var(--text-main)" }}>
            日経225の225銘柄をワンクリックで登録できます。登録後、財務指標はバックグラウンドで自動取得されます。
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={seed}
              disabled={seeding}
              className="text-sm px-4 py-2 rounded-lg font-medium text-white disabled:opacity-50 transition-opacity"
              style={{ background: "var(--accent)" }}
            >
              {seeding ? "登録中..." : "日経225を登録する"}
            </button>
            <label
              className={`text-sm px-4 py-2 rounded-lg cursor-pointer transition-colors ${importing ? "opacity-50" : "hover:opacity-80"}`}
              style={{ background: "var(--bg-page)", border: "1px solid var(--border-card)", color: "var(--text-main)" }}
            >
              {importing ? "取込中..." : "JPX CSVを取り込む"}
              <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileChange} className="hidden" disabled={importing} />
            </label>
            <a
              href="https://www.jpx.co.jp/markets/statistics-equities/misc/01.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs self-center hover:underline"
              style={{ color: "var(--accent)" }}
            >
              JPX 上場銘柄一覧 →
            </a>
          </div>
        </div>
      )}

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
                    <th className="text-right py-3 pr-5 font-medium">時価総額</th>
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
                      <td className="py-2.5 pr-5 text-right text-xs" style={{ color: "var(--text-sub)" }}>{s.marketCap != null ? `${(s.marketCap / 1e8).toFixed(0)}億` : "-"}</td>
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

- [ ] **Step 3: src/app/stocks/page.tsx を作成する**

```tsx
// src/app/stocks/page.tsx
"use client";

import { useState } from "react";
import StockScreening from "@/features/screening/components/StockScreening";
import HoldingModal from "@/features/portfolio/components/HoldingModal";
import { useHoldings } from "@/features/portfolio/hooks/useHoldings";
import { Stock, HoldingSaveInput } from "@/types";

export default function StocksPage() {
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const { save } = useHoldings();

  async function handleSave(data: HoldingSaveInput) {
    await save(data);
    setSelectedStock(null);
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold" style={{ color: "var(--text-main)" }}>銘柄DB</h1>
      <StockScreening onAddStock={(stock) => setSelectedStock(stock)} />
      {selectedStock && (
        <HoldingModal
          holding={null}
          initialStock={selectedStock}
          onSave={handleSave}
          onClose={() => setSelectedStock(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: TypeScript チェック**

```bash
npx tsc --noEmit
```

Expected: エラー0件。

- [ ] **Step 5: コミット**

```bash
git add src/app/stocks/page.tsx src/features/screening/components/StockScreening.tsx src/features/portfolio/components/HoldingModal.tsx
git commit -m "feat: add stocks page, simplify StockScreening UI, add initialStock to HoldingModal"
```

---

## Task 7: チャートページを作成する

**Files:**
- Create: `src/app/charts/page.tsx`
- Modify: `src/features/charts/components/PortfolioChart.tsx`

- [ ] **Step 1: PortfolioChart.tsx にトグル機能を追加する**

```tsx
// src/features/charts/components/PortfolioChart.tsx
"use client";

import { useState, useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Holding } from "@/types";

interface Props {
  holdings: Holding[];
}

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#14b8a6"];

type PieGroup = "ticker" | "sector";
type BarValue = "amount" | "percent";

export default function PortfolioChart({ holdings }: Props) {
  const [pieGroup, setPieGroup] = useState<PieGroup>("ticker");
  const [barValue, setBarValue] = useState<BarValue>("amount");

  const pieData = useMemo(() => {
    if (pieGroup === "ticker") {
      return holdings.map((h) => ({ name: h.ticker, value: h.currentPrice * h.quantity }));
    }
    const map = new Map<string, number>();
    holdings.forEach((h) => {
      const key = h.sector || "その他";
      map.set(key, (map.get(key) ?? 0) + h.currentPrice * h.quantity);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [holdings, pieGroup]);

  const barData = useMemo(() =>
    holdings.map((h) => ({
      name: h.ticker,
      value: barValue === "amount"
        ? parseFloat(((h.currentPrice - h.purchasePrice) * h.quantity).toFixed(0))
        : parseFloat(((h.currentPrice - h.purchasePrice) / h.purchasePrice * 100).toFixed(2)),
    })),
    [holdings, barValue]
  );

  if (holdings.length === 0) {
    return (
      <div className="text-center py-16" style={{ color: "var(--text-sub)" }}>
        <p>銘柄を追加するとチャートが表示されます</p>
      </div>
    );
  }

  const toggleStyle = (active: boolean) => ({
    background: active ? "var(--accent)" : "var(--bg-page)",
    color: active ? "white" : "var(--text-sub)",
    border: `1px solid ${active ? "var(--accent)" : "var(--border-card)"}`,
    padding: "4px 12px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: active ? 600 : 400,
    cursor: "pointer",
    transition: "all 0.15s",
  });

  const cardStyle = {
    background: "var(--bg-card)",
    borderColor: "var(--border-card)",
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* 資産配分 */}
      <div className="rounded-xl border p-5" style={cardStyle}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium" style={{ color: "var(--text-sub)" }}>資産配分</h3>
          <div className="flex gap-1">
            <button style={toggleStyle(pieGroup === "ticker")} onClick={() => setPieGroup("ticker")}>銘柄別</button>
            <button style={toggleStyle(pieGroup === "sector")} onClick={() => setPieGroup("sector")}>セクター別</button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={100} paddingAngle={3} dataKey="value">
              {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip
              formatter={(v) => [`¥${Number(v).toLocaleString()}`, "評価額"]}
              contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-card)", color: "var(--text-main)" }}
            />
            <Legend wrapperStyle={{ color: "var(--text-sub)", fontSize: "12px" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 銘柄別損益 */}
      <div className="rounded-xl border p-5" style={cardStyle}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium" style={{ color: "var(--text-sub)" }}>銘柄別損益</h3>
          <div className="flex gap-1">
            <button style={toggleStyle(barValue === "amount")} onClick={() => setBarValue("amount")}>損益額</button>
            <button style={toggleStyle(barValue === "percent")} onClick={() => setBarValue("percent")}>損益率%</button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={barData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text-sub)" }} />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--text-sub)" }}
              tickFormatter={(v) => barValue === "amount"
                ? (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))
                : `${v}%`}
            />
            <Tooltip
              formatter={(v) => [barValue === "amount" ? `¥${Number(v).toLocaleString()}` : `${Number(v).toFixed(2)}%`, "損益"]}
              contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-card)", color: "var(--text-main)" }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {barData.map((entry, i) => (
                <Cell key={i} fill={entry.value >= 0 ? "var(--up)" : "var(--down)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: src/app/charts/page.tsx を作成する**

```tsx
// src/app/charts/page.tsx
"use client";

import { useHoldings } from "@/features/portfolio/hooks/useHoldings";
import PortfolioChart from "@/features/charts/components/PortfolioChart";

export default function ChartsPage() {
  const { allHoldings, loading } = useHoldings();

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold" style={{ color: "var(--text-main)" }}>チャート</h1>
      {loading ? (
        <p className="text-center py-16" style={{ color: "var(--text-sub)" }}>読み込み中...</p>
      ) : (
        <PortfolioChart holdings={allHoldings} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: TypeScript チェック**

```bash
npx tsc --noEmit
```

Expected: エラー0件。

- [ ] **Step 4: コミット**

```bash
git add src/app/charts/page.tsx src/features/charts/components/PortfolioChart.tsx
git commit -m "feat: add charts page with toggleable pie/bar chart views"
```

---

## Task 8: HoldingModal をダークテーマ対応にする

**Files:**
- Modify: `src/features/portfolio/components/HoldingModal.tsx`

- [ ] **Step 1: HoldingModal の style を CSS variables で更新する**

HoldingModal の modal 外枠・入力フィールドを CSS variables に切り替える。`src/features/portfolio/components/HoldingModal.tsx` を読んで、以下のように style 属性を追加する：

モーダル外枠 div（`bg-white rounded-2xl shadow-xl`）を以下に変更：
```tsx
<div
  className="rounded-2xl shadow-2xl w-full max-w-md p-6 my-4 border"
  style={{ background: "var(--bg-card)", borderColor: "var(--border-card)" }}
>
```

タイトル `h2` に `style={{ color: "var(--text-main)" }}` を追加。

`<style jsx>` ブロックを以下に更新：
```jsx
<style jsx>{`
  .input {
    width: 100%;
    border: 1px solid var(--border-card);
    border-radius: 10px;
    padding: 8px 12px;
    font-size: 14px;
    outline: none;
    background: var(--bg-page);
    color: var(--text-main);
  }
  .input:focus {
    box-shadow: 0 0 0 3px rgba(99,102,241,0.3);
    border-color: var(--accent);
  }
`}</style>
```

label の `text-gray-600` を `style={{ color: "var(--text-sub)" }}` に変更（Field コンポーネント内）。

銘柄選択済み表示の `bg-indigo-50 border-indigo-200` を以下に変更：
```tsx
<div
  className="flex items-center justify-between rounded-xl px-4 py-3 border"
  style={{ background: "rgba(99,102,241,0.1)", borderColor: "rgba(99,102,241,0.3)" }}
>
```

- [ ] **Step 2: TypeScript チェック**

```bash
npx tsc --noEmit
```

Expected: エラー0件。

- [ ] **Step 3: コミット**

```bash
git add src/features/portfolio/components/HoldingModal.tsx
git commit -m "feat: apply dark theme to HoldingModal"
```

---

## Task 9: AI フローティングボタンを実装する

**Files:**
- Modify: `src/components/AIFloatingButton.tsx`（プレースホルダーを本実装に置き換え）

- [ ] **Step 1: AIFloatingButton.tsx を本実装に書き換える**

```tsx
// src/components/AIFloatingButton.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useHoldings } from "@/features/portfolio/hooks/useHoldings";
import { useAIChat } from "@/features/ai-advice/hooks/useAIChat";

const SUGGESTIONS = [
  "現在のポートフォリオのリスク分析をしてください",
  "分散投資のアドバイスをお願いします",
  "含み損の銘柄はどうすればよいですか？",
];

export default function AIFloatingButton() {
  const [open, setOpen] = useState(false);
  const { allHoldings } = useHoldings();
  const { messages, input, setInput, send, loading } = useAIChat(allHoldings);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <>
      {/* FAB ボタン */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium text-white shadow-lg transition-all hover:scale-105"
          style={{ background: "var(--accent)" }}
        >
          💬 AIに相談
        </button>
      )}

      {/* チャットパネル */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl border shadow-2xl overflow-hidden"
          style={{
            width: "380px",
            height: "500px",
            background: "var(--bg-card)",
            borderColor: "var(--border-card)",
          }}
        >
          {/* ヘッダー */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ background: "var(--bg-sidebar)", borderBottom: "1px solid var(--border-card)" }}
          >
            <span className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
              💬 AIアドバイザー
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-lg leading-none hover:opacity-60 transition-opacity"
              style={{ color: "var(--text-sub)" }}
            >
              ×
            </button>
          </div>

          {/* メッセージエリア */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div>
                <p className="text-xs mb-3" style={{ color: "var(--text-sub)" }}>
                  ポートフォリオについて質問できます。
                </p>
                <div className="space-y-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="block w-full text-left text-xs px-3 py-2 rounded-lg border transition-colors hover:opacity-80"
                      style={{
                        background: "rgba(99,102,241,0.1)",
                        borderColor: "rgba(99,102,241,0.2)",
                        color: "var(--text-main)",
                      }}
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
                    className="max-w-[85%] rounded-2xl px-3 py-2 text-xs whitespace-pre-wrap"
                    style={{
                      background: msg.role === "user" ? "var(--accent)" : "var(--bg-page)",
                      color: "var(--text-main)",
                    }}
                  >
                    {msg.content || (
                      <span className="inline-flex gap-1">
                        <span className="animate-bounce">●</span>
                        <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>●</span>
                        <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>●</span>
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* 入力エリア */}
          <div
            className="flex gap-2 p-3 flex-shrink-0"
            style={{ borderTop: "1px solid var(--border-card)" }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="投資について質問する..."
              disabled={loading}
              className="flex-1 text-xs px-3 py-2 rounded-lg border focus:outline-none focus:ring-1"
              style={{
                background: "var(--bg-page)",
                borderColor: "var(--border-card)",
                color: "var(--text-main)",
              }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-40 transition-opacity"
              style={{ background: "var(--accent)" }}
            >
              送信
            </button>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: TypeScript チェック（エラー0件を確認）**

```bash
npx tsc --noEmit
```

Expected: **エラー0件**。

- [ ] **Step 3: コミット**

```bash
git add src/components/AIFloatingButton.tsx
git commit -m "feat: implement AI floating button with dark chat panel"
```

---

## Task 10: 最終確認とプッシュ

- [ ] **Step 1: TypeScript チェック（最終）**

```bash
npx tsc --noEmit
```

Expected: エラー0件。

- [ ] **Step 2: 成功基準チェック**

以下を手動で確認する：

```
- [ ] サイドバーから 概要 / 保有一覧 / 銘柄DB / チャート の4ページに遷移できる
- [ ] ページ背景が #0f1117 のダークカラー
- [ ] 概要ページに KPI バー（4指標）・Pie チャート・損益ランキング・保有プレビューが表示される
- [ ] 保有0件のとき概要ページにオンボーディングバナーが表示される
- [ ] 保有一覧ページのテーブルが4列 + ⋯ メニューで動作する
- [ ] 銘柄DBページのスクリーニング結果に「追加 +」ボタンがあり HoldingModal が開く
- [ ] チャートページで銘柄別/セクター別・損益額/損益率 をトグルで切り替えられる
- [ ] 右下の「💬 AIに相談」FABをクリックするとチャットパネルが開く
- [ ] アプリ起動時（ページ読み込み時）に未同期銘柄があればヘッダーに「⟳ 同期中 X/Y」が表示される
```

- [ ] **Step 3: プッシュ**

```bash
git push origin master
```

---

## 成功基準チェックリスト

- [ ] 4ページのルーティングが動作する（`/`, `/portfolio`, `/stocks`, `/charts`）
- [ ] ダークテーマ（`#0f1117` 背景）が全ページに適用されている
- [ ] 概要ページの KPI・Pie・ランキング・プレビューテーブルが表示される
- [ ] 初回（保有0件）時にオンボーディングバナーが表示される
- [ ] PortfolioTable が4列 + ⋯ メニューになっている
- [ ] StockScreening の同期UIが削除されている
- [ ] 銘柄DBの「追加+」ボタンから HoldingModal が開ける
- [ ] PortfolioChart がトグルで切り替えられる
- [ ] AI FAB が右下から開閉できる
- [ ] `npx tsc --noEmit` がエラー0件
