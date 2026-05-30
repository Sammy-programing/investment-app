"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Holding } from "@/types";

interface Props {
  holdings: Holding[];
}

const COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#ef4444",
  "#14b8a6",
];

export default function PortfolioChart({ holdings }: Props) {
  if (holdings.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>銘柄を追加するとチャートが表示されます</p>
      </div>
    );
  }

  const pieData = holdings.map((h) => ({
    name: h.ticker,
    value: h.currentPrice * h.quantity,
  }));

  const barData = holdings.map((h) => ({
    name: h.ticker,
    損益: parseFloat(
      ((h.currentPrice - h.purchasePrice) * h.quantity).toFixed(0)
    ),
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <h3 className="text-sm font-medium text-gray-600 mb-3">資産配分</h3>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={100}
              paddingAngle={3}
              dataKey="value"
            >
              {pieData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [`¥${value.toLocaleString()}`, "評価額"]}
            />
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
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) =>
                v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
              }
            />
            <Tooltip
              formatter={(value: number) => [
                `¥${value.toLocaleString()}`,
                "損益",
              ]}
            />
            <Bar
              dataKey="損益"
              radius={[4, 4, 0, 0]}
              fill="#6366f1"
            >
              {barData.map((entry, index) => (
                <Cell
                  key={`bar-${index}`}
                  fill={entry.損益 >= 0 ? "#10b981" : "#ef4444"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
