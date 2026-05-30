"use client";

import { Holding } from "@/types";

interface Props {
  holdings: Holding[];
  onEdit: (holding: Holding) => void;
  onDelete: (id: string) => void;
}

export default function PortfolioTable({ holdings, onEdit, onDelete }: Props) {
  if (holdings.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">保有銘柄がありません</p>
        <p className="text-sm mt-1">「銘柄を追加」から投資銘柄を登録してください</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-600 text-left">
            <th className="pb-3 pr-4 font-medium">銘柄名</th>
            <th className="pb-3 pr-4 font-medium">ティッカー</th>
            <th className="pb-3 pr-4 font-medium text-right">保有数</th>
            <th className="pb-3 pr-4 font-medium text-right">購入単価</th>
            <th className="pb-3 pr-4 font-medium text-right">現在値</th>
            <th className="pb-3 pr-4 font-medium text-right">評価額</th>
            <th className="pb-3 pr-4 font-medium text-right">損益</th>
            <th className="pb-3 font-medium text-center">操作</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const value = h.currentPrice * h.quantity;
            const cost = h.purchasePrice * h.quantity;
            const pl = value - cost;
            const plPct = ((h.currentPrice - h.purchasePrice) / h.purchasePrice) * 100;
            const isPositive = pl >= 0;

            return (
              <tr key={h.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 pr-4 font-medium">{h.name}</td>
                <td className="py-3 pr-4 text-gray-600">{h.ticker}</td>
                <td className="py-3 pr-4 text-right">{h.quantity.toLocaleString()}</td>
                <td className="py-3 pr-4 text-right">¥{h.purchasePrice.toLocaleString()}</td>
                <td className="py-3 pr-4 text-right">¥{h.currentPrice.toLocaleString()}</td>
                <td className="py-3 pr-4 text-right font-medium">¥{value.toLocaleString()}</td>
                <td className={`py-3 pr-4 text-right font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}>
                  <div>{isPositive ? "+" : ""}¥{pl.toLocaleString()}</div>
                  <div className="text-xs">({isPositive ? "+" : ""}{plPct.toFixed(2)}%)</div>
                </td>
                <td className="py-3 text-center">
                  <button
                    onClick={() => onEdit(h)}
                    className="text-blue-600 hover:text-blue-800 mr-3 text-xs font-medium"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => onDelete(h.id)}
                    className="text-red-500 hover:text-red-700 text-xs font-medium"
                  >
                    削除
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
