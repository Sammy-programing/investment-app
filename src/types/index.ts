export interface Holding {
  id: string;
  stockId: string;
  name: string;
  ticker: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate?: string | null;
  currentPrice: number;
  sector: string;
  per?: number | null;
  pbr?: number | null;
  dividendYield?: number | null;
  marketCap?: number | null;
}

export interface HoldingSaveInput {
  id?: string;
  stockId: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate?: string | null;
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

export interface StockSearchResult {
  ticker: string;
  name: string;
  exchange: string;
}

export interface Stock {
  id: string;
  ticker: string;
  name: string;
  sector?: string | null;
  market?: string | null;
  currentPrice?: number | null;
  per?: number | null;
  pbr?: number | null;
  dividendYield?: number | null;
  marketCap?: number | null;
  eps?: number | null;
  roe?: number | null;
  shinyoBairitsu?: number | null;
  lastUpdated?: string | null;
}

export interface ScreeningCriteria {
  sector: string;
  perMax: string;
  pbrMax: string;
  dyMin: string;
  plMin: string;
  plMax: string;
}
