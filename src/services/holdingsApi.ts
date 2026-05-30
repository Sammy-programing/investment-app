import { Holding, HoldingSaveInput } from "@/types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`API error: ${res.status} ${url}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function fetchHoldings(q?: string, sector?: string): Promise<Holding[]> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (sector) params.set("sector", sector);
  return request<Holding[]>(`/api/holdings?${params}`);
}

export async function createHolding(data: Omit<HoldingSaveInput, "id">): Promise<Holding> {
  return request<Holding>("/api/holdings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      stockId: data.stockId,
      quantity: data.quantity,
      purchasePrice: data.purchasePrice,
      purchaseDate: data.purchaseDate ?? null,
    }),
  });
}

export async function updateHolding(
  id: string,
  data: Pick<HoldingSaveInput, "quantity" | "purchasePrice" | "purchaseDate">
): Promise<Holding> {
  return request<Holding>(`/api/holdings/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quantity: data.quantity,
      purchasePrice: data.purchasePrice,
      purchaseDate: data.purchaseDate ?? null,
    }),
  });
}

export async function deleteHolding(id: string): Promise<void> {
  await request<void>(`/api/holdings/${id}`, { method: "DELETE" });
}
