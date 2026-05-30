// src/features/portfolio/hooks/useHoldings.ts
import { useState, useEffect, useCallback } from "react";
import { Holding } from "@/types";
import { fetchHoldings, createHolding, updateHolding, deleteHolding } from "@/services/holdingsApi";

export function useHoldings() {
  const [allHoldings, setAllHoldings] = useState<Holding[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");

  const load = useCallback(async (q = searchQuery, sector = sectorFilter) => {
    const data = await fetchHoldings(q, sector);
    setHoldings(data);
    if (!q && !sector) setAllHoldings(data);
    setLoading(false);
  }, [searchQuery, sectorFilter]);

  // フィルターなしの全件を別途取得（stats 計算用）
  const loadAll = useCallback(async () => {
    const data = await fetchHoldings();
    setAllHoldings(data);
  }, []);

  useEffect(() => { load(); loadAll(); }, []);

  useEffect(() => {
    const t = setTimeout(() => load(searchQuery, sectorFilter), 300);
    return () => clearTimeout(t);
  }, [searchQuery, sectorFilter]);

  async function save(data: Omit<Holding, "id"> & { id?: string }) {
    if (data.id) {
      const { id, ...rest } = data;
      await updateHolding(id, rest);
    } else {
      await createHolding(data);
    }
    load();
    loadAll();
  }

  async function remove(id: string) {
    await deleteHolding(id);
    load();
    loadAll();
  }

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
