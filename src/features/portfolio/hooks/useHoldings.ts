// src/features/portfolio/hooks/useHoldings.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { Holding, HoldingSaveInput } from "@/types";
import { fetchHoldings, createHolding, updateHolding, deleteHolding } from "@/services/holdingsApi";

export function useHoldings() {
  const [allHoldings, setAllHoldings] = useState<Holding[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");
  const mountedRef = useRef(false);

  const load = useCallback(async (q = searchQuery, sector = sectorFilter) => {
    const data = await fetchHoldings(q, sector);
    setHoldings(data);
    if (!q && !sector) setAllHoldings(data);
    setLoading(false);
  }, [searchQuery, sectorFilter]);

  const loadAll = useCallback(async () => {
    const data = await fetchHoldings();
    setAllHoldings(data);
  }, []);

  useEffect(() => {
    load();
    loadAll();
    mountedRef.current = true;
  }, []);

  useEffect(() => {
    if (!mountedRef.current) return;
    const t = setTimeout(() => load(searchQuery, sectorFilter), 300);
    return () => clearTimeout(t);
  }, [searchQuery, sectorFilter, load]);

  const save = useCallback(async (data: HoldingSaveInput) => {
    if (data.id) {
      await updateHolding(data.id, {
        quantity: data.quantity,
        purchasePrice: data.purchasePrice,
        purchaseDate: data.purchaseDate,
      });
    } else {
      await createHolding({
        stockId: data.stockId,
        quantity: data.quantity,
        purchasePrice: data.purchasePrice,
        purchaseDate: data.purchaseDate,
      });
    }
    load();
    loadAll();
  }, [load, loadAll]);

  const remove = useCallback(async (id: string) => {
    await deleteHolding(id);
    load();
    loadAll();
  }, [load, loadAll]);

  return {
    holdings,
    allHoldings,
    loading,
    searchQuery,
    setSearchQuery,
    sectorFilter,
    setSectorFilter,
    save,
    remove,
  };
}
