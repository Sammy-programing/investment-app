// src/features/portfolio/components/HoldingModal.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Holding, HoldingSaveInput, Stock } from "@/types";
import { searchStocks } from "@/services/stocksApi";

interface Props {
  holding?: Holding | null;
  initialStock?: Stock | null;
  onSave: (data: HoldingSaveInput) => void;
  onClose: () => void;
}

export default function HoldingModal({ holding, initialStock, onSave, onClose }: Props) {
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [stockQuery, setStockQuery] = useState("");
  const [stockResults, setStockResults] = useState<Stock[]>([]);
  const [searching, setSearching] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");

  useEffect(() => {
    if (holding) {
      setStockQuery(holding.ticker);
      setSelectedStock({
        id: holding.stockId,
        ticker: holding.ticker,
        name: holding.name,
        sector: holding.sector,
        currentPrice: holding.currentPrice,
        per: holding.per,
        pbr: holding.pbr,
        dividendYield: holding.dividendYield,
        marketCap: holding.marketCap,
      });
      setQuantity(String(holding.quantity));
      setPurchasePrice(String(holding.purchasePrice));
      setPurchaseDate(
        holding.purchaseDate
          ? new Date(holding.purchaseDate).toISOString().split("T")[0]
          : ""
      );
    }
  }, [holding]);

  useEffect(() => {
    if (initialStock && !holding) {
      setSelectedStock(initialStock);
      setStockQuery(initialStock.ticker);
    }
  }, [initialStock, holding]);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 1) { setStockResults([]); return; }
    setSearching(true);
    try {
      setStockResults(await searchStocks({ q, limit: "10" }));
    } catch {
      setStockResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (selectedStock) return;
    const t = setTimeout(() => doSearch(stockQuery), 400);
    return () => clearTimeout(t);
  }, [stockQuery, doSearch, selectedStock]);

  function handleSelectStock(s: Stock) {
    setSelectedStock(s);
    setStockQuery(s.ticker);
    setStockResults([]);
  }

  function handleClearStock() {
    setSelectedStock(null);
    setStockQuery("");
    setStockResults([]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStock) return;
    onSave({
      id: holding?.id,
      stockId: selectedStock.id,
      quantity: parseFloat(quantity),
      purchasePrice: parseFloat(purchasePrice),
      purchaseDate: purchaseDate || null,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 my-4">
        <h2 className="text-lg font-bold mb-5">{holding ? "銘柄を編集" : "銘柄を追加"}</h2>

        {/* 銘柄選択 */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            銘柄 <span className="text-red-400">*</span>
            <span className="text-gray-400 font-normal ml-1">（スクリーニングで登録済みの銘柄から選択）</span>
          </label>

          {selectedStock ? (
            <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
              <div>
                <span className="font-mono text-indigo-700 text-sm font-medium">{selectedStock.ticker}</span>
                <span className="text-gray-700 ml-2 text-sm">{selectedStock.name}</span>
                {selectedStock.sector && (
                  <span className="text-gray-400 text-xs ml-2">{selectedStock.sector}</span>
                )}
              </div>
              {!holding && (
                <button
                  type="button"
                  onClick={handleClearStock}
                  className="text-gray-400 hover:text-gray-600 text-xs ml-2"
                >
                  変更
                </button>
              )}
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={stockQuery}
                onChange={(e) => setStockQuery(e.target.value)}
                placeholder="ティッカーまたは銘柄名で検索..."
                className="input w-full"
                autoFocus
              />
              {searching && <p className="text-xs text-gray-400 mt-1">検索中...</p>}
              {stockResults.length > 0 && (
                <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 overflow-hidden">
                  {stockResults.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectStock(s)}
                      className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 text-sm border-b border-gray-100 last:border-0"
                    >
                      <span className="font-mono font-medium text-indigo-700">{s.ticker}</span>
                      <span className="text-gray-600 ml-2">{s.name}</span>
                      {s.sector && <span className="text-gray-400 text-xs ml-1">{s.sector}</span>}
                    </button>
                  ))}
                </div>
              )}
              {!searching && stockQuery.length >= 1 && stockResults.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  見つかりません。先にスクリーニング画面で銘柄を登録してください。
                </p>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="保有数" required>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="100"
                min="0"
                step="any"
                required
                className="input"
              />
            </Field>
            <Field label="購入単価 (¥)" required>
              <input
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="1500"
                min="0"
                step="any"
                required
                className="input"
              />
            </Field>
          </div>

          <Field label="購入日">
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="input"
            />
          </Field>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={!selectedStock}
              className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
            >
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
