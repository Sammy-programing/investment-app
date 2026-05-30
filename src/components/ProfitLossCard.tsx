"use client";

import { PortfolioStats } from "@/types";

interface Props {
  stats: PortfolioStats;
}

export default function ProfitLossCard({ stats }: Props) {
  const isPositive = stats.totalProfitLoss >= 0;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatCard
        label="総評価額"
        value={`¥${stats.totalValue.toLocaleString()}`}
        sub=""
        color="text-gray-900"
      />
      <StatCard
        label="総取得コスト"
        value={`¥${stats.totalCost.toLocaleString()}`}
        sub=""
        color="text-gray-900"
      />
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

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      {sub && <p className={`text-xs mt-0.5 ${color}`}>{sub}</p>}
    </div>
  );
}
