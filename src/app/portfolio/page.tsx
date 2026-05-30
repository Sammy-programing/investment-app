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
