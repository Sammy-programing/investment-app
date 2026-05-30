// src/features/screening/components/StockScreening.tsx
"use client";

import { useRef } from "react";
import { useScreening } from "../hooks/useScreening";
import { useStockSync } from "../hooks/useStockSync";

const SECTORS = [
  "", "水産・農林", "鉱業", "建設", "食品", "繊維", "パルプ・紙", "化学",
  "医薬品", "石油・石炭", "ゴム", "ガラス・土石", "鉄鋼", "非鉄金属",
  "機械", "電機", "輸送用機器", "精密機器", "商社", "小売", "銀行",
  "証券・商品先物", "保険", "その他金融", "不動産", "陸運", "海運",
  "空運", "倉庫・運輸", "情報・通信", "電力・ガス", "サービス", "その他",
];

const MARKETS = ["", "プライム", "スタンダード", "グロース"];

export default function StockScreening() {
  const { criteria, set, results, searching, screen, reset } = useScreening();
  const { sync, start, stop, seeding, seedDone, seed, importing, importCsv } = useStockSync();
  const fileRef = useRef<HTMLInputElement>(null);

  const syncPct = sync.total > 0 ? Math.round((sync.processed / sync.total) * 100) : 0;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    importCsv(file).finally(() => { if (fileRef.current) fileRef.current.value = ""; });
  }

  return (
    <div className="space-y-5">
      {/* データ準備 */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <p className="text-sm font-medium text-gray-700">① データ準備</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={seed} disabled={seeding} className="text-sm px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            {seeding ? "登録中..." : seedDone ? "✓ 日経225登録済み" : "日経225をDBに登録 (225銘柄)"}
          </button>
          <label className={`text-sm px-4 py-2 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 ${importing ? "opacity-50" : ""}`}>
            {importing ? "取込中..." : "JPX CSVを取り込む"}
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileChange} className="hidden" disabled={importing} />
          </label>
          <a href="https://www.jpx.co.jp/markets/statistics-equities/misc/01.html" target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline self-center">
            JPX 上場銘柄一覧 →
          </a>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">② Yahoo Finance から財務指標を同期</p>
          <div className="flex items-center gap-3">
            {!sync.running ? (
              <button onClick={start} disabled={sync.done} className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {sync.done ? "同期完了" : "同期開始"}
              </button>
            ) : (
              <button onClick={stop} className="text-sm px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">停止</button>
            )}
            {(sync.running || sync.done || sync.processed > 0) && (
              <div className="flex-1 space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{sync.processed}/{sync.total > 0 ? sync.total : "?"}件処理済み</span>
                  {sync.failed > 0 && <span className="text-red-400">失敗: {sync.failed}件</span>}
                  <span>{syncPct}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${sync.done ? "bg-green-500" : "bg-indigo-500"}`} style={{ width: `${syncPct}%` }} />
                </div>
                <p className="text-xs text-gray-400">{sync.running ? "10件/バッチ、200ms間隔で取得中..." : sync.done ? "同期完了" : "停止中"}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* スクリーニング条件 */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700">③ スクリーニング条件</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">銘柄名・ティッカー</label>
            <input type="text" value={criteria.q} onChange={set("q")} placeholder="例: トヨタ, 7203" className="input w-full" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">セクター</label>
            <select value={criteria.sector} onChange={set("sector")} className="input w-full">
              {SECTORS.map((s) => <option key={s} value={s}>{s || "すべて"}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">市場</label>
            <select value={criteria.market} onChange={set("market")} className="input w-full">
              {MARKETS.map((m) => <option key={m} value={m}>{m || "すべて"}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">PER 以下</label>
            <input type="number" value={criteria.perMax} onChange={set("perMax")} placeholder="例: 20" step="any" className="input w-full" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">PBR 以下</label>
            <input type="number" value={criteria.pbrMax} onChange={set("pbrMax")} placeholder="例: 2" step="any" className="input w-full" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">配当利回り% 以上</label>
            <input type="number" value={criteria.dyMin} onChange={set("dyMin")} placeholder="例: 3" step="any" className="input w-full" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">時価総額 下限(億円)</label>
            <input type="number" value={criteria.marketCapMin} onChange={set("marketCapMin")} placeholder="例: 1000" step="any" className="input w-full" />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={screen} disabled={searching} className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {searching ? "検索中..." : "スクリーニング実行"}
          </button>
          <button onClick={reset} className="px-5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50">
            リセット
          </button>
        </div>
      </div>

      {/* 結果テーブル */}
      {results !== null && (
        <div>
          <p className="text-sm text-gray-500 mb-3">結果: <span className="font-medium text-gray-800">{results.length}件</span></p>
          {results.length === 0 ? (
            <p className="text-center text-gray-400 py-8">条件に一致する銘柄がありません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 text-left">
                    <th className="pb-2 pr-3 font-medium">ティッカー</th>
                    <th className="pb-2 pr-3 font-medium">銘柄名</th>
                    <th className="pb-2 pr-3 font-medium">セクター</th>
                    <th className="pb-2 pr-3 font-medium text-right">現在値</th>
                    <th className="pb-2 pr-3 font-medium text-right">PER</th>
                    <th className="pb-2 pr-3 font-medium text-right">PBR</th>
                    <th className="pb-2 pr-3 font-medium text-right">配当%</th>
                    <th className="pb-2 font-medium text-right">時価総額</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((s) => (
                    <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 pr-3 font-mono text-indigo-600 text-xs">{s.ticker}</td>
                      <td className="py-2 pr-3 font-medium">{s.name}</td>
                      <td className="py-2 pr-3 text-gray-500 text-xs">{s.sector ?? "-"}</td>
                      <td className="py-2 pr-3 text-right">{s.currentPrice != null ? `¥${s.currentPrice.toLocaleString()}` : "-"}</td>
                      <td className="py-2 pr-3 text-right">{s.per != null ? s.per.toFixed(1) : "-"}</td>
                      <td className="py-2 pr-3 text-right">{s.pbr != null ? s.pbr.toFixed(2) : "-"}</td>
                      <td className="py-2 pr-3 text-right">{s.dividendYield != null ? `${s.dividendYield.toFixed(2)}%` : "-"}</td>
                      <td className="py-2 text-right text-xs text-gray-500">{s.marketCap != null ? `${(s.marketCap / 1e8).toFixed(0)}億` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .input { border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px 12px; font-size: 14px; outline: none; }
        .input:focus { box-shadow: 0 0 0 3px rgba(99,102,241,0.2); border-color: #6366f1; }
      `}</style>
    </div>
  );
}
