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
import { Holding, HoldingSaveInput } from "@/types";

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

  async function handleSave(data: HoldingSaveInput) {
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
