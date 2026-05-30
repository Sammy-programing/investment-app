// src/features/portfolio/hooks/usePortfolioStats.ts
import { useMemo } from "react";
import { Holding, PortfolioStats } from "@/types";

export function usePortfolioStats(holdings: Holding[]): PortfolioStats {
  return useMemo(() => {
    const totalValue = holdings.reduce((s, h) => s + h.currentPrice * h.quantity, 0);
    const totalCost = holdings.reduce((s, h) => s + h.purchasePrice * h.quantity, 0);
    const totalProfitLoss = totalValue - totalCost;
    const totalProfitLossPercent = totalCost > 0 ? (totalProfitLoss / totalCost) * 100 : 0;
    return { totalValue, totalCost, totalProfitLoss, totalProfitLossPercent };
  }, [holdings]);
}
