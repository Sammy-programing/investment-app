// src/services/stocksApi.ts
import { Stock, StockSearchResult } from "@/types";

export interface SyncJobResult {
  done: boolean;
  remaining: number;
  processed: number;
  total: number;
  failed: number;
  jobId: string;
}

export interface StockQuote {
  name: string;
  currentPrice?: number;
  per?: number;
  pbr?: number;
  dividendYield?: number;
  marketCap?: number;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`API error: ${res.status} ${url}`);
  return res.json();
}

export async function searchStocksByQuery(q: string): Promise<StockSearchResult[]> {
  return request<StockSearchResult[]>(`/api/stock/search?q=${encodeURIComponent(q)}`);
}

export async function fetchStockQuote(ticker: string): Promise<StockQuote> {
  return request<StockQuote>(`/api/stock/quote/${encodeURIComponent(ticker)}`);
}

export async function searchStocks(params: Record<string, string>): Promise<Stock[]> {
  const p = new URLSearchParams(params);
  return request<Stock[]>(`/api/stocks?${p}`);
}

export async function getSyncCount(): Promise<{ total: number }> {
  return request<{ total: number }>("/api/stocks/sync");
}

export async function syncStocks(jobId?: string): Promise<SyncJobResult> {
  return request<SyncJobResult>("/api/stocks/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId }),
  });
}

export async function seedNikkei225(): Promise<{ seeded: number }> {
  return request<{ seeded: number }>("/api/stocks/seed", { method: "POST" });
}

export async function importStocksCsv(text: string): Promise<{ imported: number; error?: string }> {
  return request<{ imported: number; error?: string }>("/api/stocks/import", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: text,
  });
}
