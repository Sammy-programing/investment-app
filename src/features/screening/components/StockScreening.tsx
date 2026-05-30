// src/features/screening/components/StockScreening.tsx
"use client";

import { useScreening } from "../hooks/useScreening";
import { Stock } from "@/types";

const SECTORS = [
  "", "水産・農林", "鉱業", "建設", "食品", "繊維", "パルプ・紙", "化学",
  "医薬品", "石油・石炭", "ゴム", "ガラス・土石", "鉄鋼", "非鉄金属",
  "機械", "電機", "輸送用機器", "精密機器", "商社", "小売", "銀行",
  "証券・商品先物", "保険", "その他金融", "不動産", "陸運", "海運",
  "空運", "倉庫・運輸", "情報・通信", "電力・ガス", "サービス", "その他",
];

const MARKETS = ["", "プライム", "スタンダード", "グロース"];

interface Props {
  onAddStock?: (stock: Stock) => void;
}

export default function StockScreening({ onAddStock }: Props) {
  const { criteria, set, results, searching, screen, reset } = useScreening();

  const inputStyle = {
    background: "var(--bg-page)",
    borderColor: "var(--border-card)",
    color: "var(--text-main)",
    border: "1px solid var(--border-card)",
    borderRadius: "10px",
    padding: "8px 12px",
    fontSize: "14px",
    outline: "none",
    width: "100%",
  };

  return (
    <div className="space-y-5">
      {/* スクリーニング条件 */}
      <div
        className="rounded-xl border p-5 space-y-4"
        style={{ background: "var(--bg-card)", borderColor: "var(--border-card)" }}
      >
        <p className="text-sm font-medium" style={{ color: "var(--text-sub)" }}>スクリーニング条件</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className="text-xs block mb-1" style={{ color: "var(--text-sub)" }}>銘柄名・ティッカー</label>
            <input type="text" value={criteria.q} onChange={set("q")} placeholder="例: トヨタ, 7203" style={inputStyle} />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: "var(--text-sub)" }}>セクター</label>
            <select value={criteria.sector} onChange={set("sector")} style={inputStyle}>
              {SECTORS.map((s) => <option key={s} value={s}>{s || "すべて"}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: "var(--text-sub)" }}>市場</label>
            <select value={criteria.market} onChange={set("market")} style={inputStyle}>
              {MARKETS.map((m) => <option key={m} value={m}>{m || "すべて"}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: "var(--text-sub)" }}>PER 以下</label>
            <input type="number" value={criteria.perMax} onChange={set("perMax")} placeholder="例: 20" step="any" style={inputStyle} />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: "var(--text-sub)" }}>PBR 以下</label>
            <input type="number" value={criteria.pbrMax} onChange={set("pbrMax")} placeholder="例: 2" step="any" style={inputStyle} />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: "var(--text-sub)" }}>配当利回り% 以上</label>
            <input type="number" value={criteria.dyMin} onChange={set("dyMin")} placeholder="例: 3" step="any" style={inputStyle} />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: "var(--text-sub)" }}>時価総額 下限(億円)</label>
            <input type="number" value={criteria.marketCapMin} onChange={set("marketCapMin")} placeholder="例: 1000" step="any" style={inputStyle} />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: "var(--text-sub)" }}>信用倍率 以下</label>
            <input type="number" value={criteria.shinyoBairitsuMax} onChange={set("shinyoBairitsuMax")} placeholder="例: 3" step="0.01" style={inputStyle} />
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={screen}
            disabled={searching}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 transition-opacity"
            style={{ background: "var(--accent)" }}
          >
            {searching ? "検索中..." : "スクリーニング実行"}
          </button>
          <button
            onClick={reset}
            className="px-5 rounded-xl text-sm font-medium transition-colors hover:bg-white/5"
            style={{ border: "1px solid var(--border-card)", color: "var(--text-sub)" }}
          >
            リセット
          </button>
        </div>
      </div>

      {/* 結果テーブル */}
      {results !== null && (
        <div
          className="rounded-xl border"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-card)" }}
        >
          <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border-card)" }}>
            <span className="text-sm" style={{ color: "var(--text-sub)" }}>
              結果: <span className="font-medium" style={{ color: "var(--text-main)" }}>{results.length}件</span>
            </span>
          </div>
          {results.length === 0 ? (
            <p className="text-center py-10" style={{ color: "var(--text-sub)" }}>条件に一致する銘柄がありません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--border-card)", color: "var(--text-sub)" }}>
                    <th className="text-left px-5 py-3 font-medium">ティッカー</th>
                    <th className="text-left py-3 font-medium">銘柄名</th>
                    <th className="text-left py-3 font-medium">セクター</th>
                    <th className="text-right py-3 pr-4 font-medium">現在値</th>
                    <th className="text-right py-3 pr-4 font-medium">PER</th>
                    <th className="text-right py-3 pr-4 font-medium">PBR</th>
                    <th className="text-right py-3 pr-4 font-medium">配当%</th>
                    <th className="text-right py-3 pr-4 font-medium">信用倍率</th>
                    {onAddStock && <th className="py-3 pr-5"></th>}
                  </tr>
                </thead>
                <tbody>
                  {results.map((s) => (
                    <tr key={s.id} className="border-b hover:bg-white/3 transition-colors" style={{ borderColor: "var(--border-card)" }}>
                      <td className="px-5 py-2.5 font-mono text-xs" style={{ color: "var(--accent)" }}>{s.ticker}</td>
                      <td className="py-2.5 font-medium" style={{ color: "var(--text-main)" }}>{s.name}</td>
                      <td className="py-2.5 text-xs" style={{ color: "var(--text-sub)" }}>{s.sector ?? "-"}</td>
                      <td className="py-2.5 pr-4 text-right" style={{ color: "var(--text-main)" }}>{s.currentPrice != null ? `¥${s.currentPrice.toLocaleString()}` : "-"}</td>
                      <td className="py-2.5 pr-4 text-right" style={{ color: "var(--text-main)" }}>{s.per != null ? s.per.toFixed(1) : "-"}</td>
                      <td className="py-2.5 pr-4 text-right" style={{ color: "var(--text-main)" }}>{s.pbr != null ? s.pbr.toFixed(2) : "-"}</td>
                      <td className="py-2.5 pr-4 text-right" style={{ color: "var(--text-main)" }}>{s.dividendYield != null ? `${s.dividendYield.toFixed(2)}%` : "-"}</td>
                      <td className="py-2.5 pr-4 text-right" style={{ color: "var(--text-main)" }}>{s.shinyoBairitsu != null ? s.shinyoBairitsu.toFixed(2) : "-"}</td>
                      {onAddStock && (
                        <td className="py-2.5 pr-5 text-right">
                          <button
                            onClick={() => onAddStock(s)}
                            className="text-xs px-3 py-1 rounded-lg font-medium text-white transition-opacity hover:opacity-80"
                            style={{ background: "var(--accent)" }}
                          >
                            追加 +
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
