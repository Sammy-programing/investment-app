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

  const toggleStyle = (active: boolean): React.CSSProperties => ({
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

  const cardStyle: React.CSSProperties = {
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
                ? (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))
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
