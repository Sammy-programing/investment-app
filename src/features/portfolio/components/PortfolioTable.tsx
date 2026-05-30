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
