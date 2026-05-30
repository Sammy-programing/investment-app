export interface Holding {
  id: string;
  name: string;
  ticker: string;
  quantity: number;
  purchasePrice: number;
  currentPrice: number;
  sector: string;
}

export interface PortfolioStats {
  totalValue: number;
  totalCost: number;
  totalProfitLoss: number;
  totalProfitLossPercent: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
