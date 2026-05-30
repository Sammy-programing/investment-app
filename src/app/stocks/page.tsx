// src/app/stocks/page.tsx
"use client";

import { useState } from "react";
import StockScreening from "@/features/screening/components/StockScreening";
import HoldingModal from "@/features/portfolio/components/HoldingModal";
import { useHoldings } from "@/features/portfolio/hooks/useHoldings";
import { Stock, HoldingSaveInput } from "@/types";

export default function StocksPage() {
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const { save } = useHoldings();

  async function handleSave(data: HoldingSaveInput) {
    await save(data);
    setSelectedStock(null);
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold" style={{ color: "var(--text-main)" }}>銘柄DB</h1>
      <StockScreening onAddStock={(stock) => setSelectedStock(stock)} />
      {selectedStock && (
        <HoldingModal
          holding={null}
          initialStock={selectedStock}
          onSave={handleSave}
          onClose={() => setSelectedStock(null)}
        />
      )}
    </div>
  );
}
