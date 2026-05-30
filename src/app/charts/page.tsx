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
