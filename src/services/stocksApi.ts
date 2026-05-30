// src/services/stocksApi.ts
import { Stock } from "@/types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`API error: ${res.status} ${url}`);
  return res.json();
}

export async function searchStocks(params: Record<string, string>): Promise<Stock[]> {
  const p = new URLSearchParams(params);
  return request<Stock[]>(`/api/stocks?${p}`);
}
