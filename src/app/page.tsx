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
