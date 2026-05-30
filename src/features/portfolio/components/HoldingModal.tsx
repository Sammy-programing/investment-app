// src/features/portfolio/components/HoldingModal.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Holding, StockSearchResult } from "@/types";
import { searchStocksByQuery, fetchStockQuote } from "@/services/stocksApi";

interface Props {
  holding?: Holding | null;
  onSave: (holding: Omit<Holding, "id"> & { id?: string }) => void;
  onClose: () => void;
}

const SECTORS = [
  "テクノロジー", "金融", "ヘルスケア", "消費財", "エネルギー",
  "素材", "不動産", "通信", "公益事業", "資本財", "その他",
];

export default function HoldingModal({ holding, onSave, onClose }: Props) {
  const [form, setForm] = useState({
    name: "", ticker: "", quantity: "", purchasePrice: "",
    currentPrice: "", sector: "テクノロジー",
    per: "", pbr: "", dividendYield: "", marketCap: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [fetchingQuote, setFetchingQuote] = useState(false);

  useEffect(() => {
    if (holding) {
      setForm({
        name: holding.name,
        ticker: holding.ticker,
        quantity: String(holding.quantity),
        purchasePrice: String(holding.purchasePrice),
        currentPrice: String(holding.currentPrice),
        sector: holding.sector,
        per: holding.per != null ? String(holding.per) : "",
        pbr: holding.pbr != null ? String(holding.pbr) : "",
        dividendYield: holding.dividendYield != null ? String(holding.dividendYield) : "",
        marketCap: holding.marketCap != null ? String(holding.marketCap) : "",
      });
      setSearchQuery(holding.ticker);
    }
  }, [holding]);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 1) { setSearchResults([]); return; }
    setSearching(true);
    try {
      setSearchResults(await searchStocksByQuery(q));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery, doSearch]);

  async function selectStock(s: StockSearchResult) {
    setSearchResults([]);
    setSearchQuery(s.ticker);
    setFetchingQuote(true);
    try {
      const q = await fetchStockQuote(s.ticker);
      setForm((prev) => ({
        ...prev,
        name: q.name ?? s.name,
        ticker: s.ticker,
        currentPrice: q.currentPrice ? String(q.currentPrice) : prev.currentPrice,
        per: q.per != null ? String(q.per.toFixed(2)) : "",
        pbr: q.pbr != null ? String(q.pbr.toFixed(2)) : "",
        dividendYield: q.dividendYield != null ? String(q.dividendYield.toFixed(2)) : "",
        marketCap: q.marketCap != null ? String(q.marketCap) : "",
      }));
    } finally {
      setFetchingQuote(false);
    }
  }

  async function refreshPrice() {
    if (!form.ticker) return;
    setFetchingQuote(true);
    try {
      const q = await fetchStockQuote(form.ticker);
      if (q.currentPrice) setForm((prev) => ({ ...prev, currentPrice: String(q.currentPrice) }));
    } finally {
      setFetchingQuote(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      id: holding?.id,
      name: form.name.trim(),
      ticker: form.ticker.trim().toUpperCase(),
      quantity: parseFloat(form.quantity),
      purchasePrice: parseFloat(form.purchasePrice),
      currentPrice: parseFloat(form.currentPrice),
      sector: form.sector,
      per: form.per ? parseFloat(form.per) : null,
      pbr: form.pbr ? parseFloat(form.pbr) : null,
      dividendYield: form.dividendYield ? parseFloat(form.dividendYield) : null,
      marketCap: form.marketCap ? parseFloat(form.marketCap) : null,
    });
  }

  const set = (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 my-4">
        <h2 className="text-lg font-bold mb-5">{holding ? "銘柄を編集" : "銘柄を追加"}</h2>

        <div className="mb-4 relative">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            銘柄検索 <span className="text-gray-400">(ティッカーまたは銘柄名)</span>
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="例: AAPL, 7203, トヨタ"
            className="input w-full"
          />
          {searching && <p className="text-xs text-gray-400 mt-1">検索中...</p>}
          {searchResults.length > 0 && (
            <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 overflow-hidden">
              {searchResults.map((r) => (
                <button
                  key={r.ticker}
                  type="button"
                  onClick={() => selectStock(r)}
                  className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 text-sm border-b border-gray-100 last:border-0"
                >
                  <span className="font-medium text-indigo-700">{r.ticker}</span>
                  <span className="text-gray-600 ml-2">{r.name}</span>
                  <span className="text-gray-400 text-xs ml-1">({r.exchange})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="銘柄名" required>
              <input type="text" value={form.name} onChange={set("name")} placeholder="例: Apple Inc." required className="input" />
            </Field>
            <Field label="ティッカー" required>
              <input type="text" value={form.ticker} onChange={set("ticker")} placeholder="例: AAPL" required className="input" />
            </Field>
          </div>
          <Field label="セクター" required>
            <select value={form.sector} onChange={set("sector")} className="input">
              {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="保有数" required>
              <input type="number" value={form.quantity} onChange={set("quantity")} placeholder="100" min="0" step="any" required className="input" />
            </Field>
            <Field label="購入単価 (¥)" required>
              <input type="number" value={form.purchasePrice} onChange={set("purchasePrice")} placeholder="150" min="0" step="any" required className="input" />
            </Field>
            <Field label="現在値 (¥)">
              <div className="flex gap-1">
                <input type="number" value={form.currentPrice} onChange={set("currentPrice")} placeholder="155" min="0" step="any" required className="input flex-1 min-w-0" />
                <button type="button" onClick={refreshPrice} disabled={fetchingQuote || !form.ticker} className="px-2 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs disabled:opacity-40" title="最新価格を取得">
                  {fetchingQuote ? "…" : "↻"}
                </button>
              </div>
            </Field>
          </div>
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-medium text-gray-500 mb-2">財務指標 (任意)</p>
            <div className="grid grid-cols-4 gap-2">
              <Field label="PER"><input type="number" value={form.per} onChange={set("per")} placeholder="15.0" step="any" className="input" /></Field>
              <Field label="PBR"><input type="number" value={form.pbr} onChange={set("pbr")} placeholder="2.0" step="any" className="input" /></Field>
              <Field label="配当利回り%"><input type="number" value={form.dividendYield} onChange={set("dividendYield")} placeholder="2.5" step="any" className="input" /></Field>
              <Field label="時価総額"><input type="number" value={form.marketCap} onChange={set("marketCap")} placeholder="3T" step="any" className="input" /></Field>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50">
              キャンセル
            </button>
            <button type="submit" className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-indigo-700">
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
