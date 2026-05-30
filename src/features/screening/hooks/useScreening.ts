// src/features/screening/hooks/useScreening.ts
import { useState } from "react";
import { Stock } from "@/types";
import { searchStocks } from "@/services/stocksApi";

interface Criteria {
  q: string;
  sector: string;
  market: string;
  perMax: string;
  pbrMax: string;
  dyMin: string;
  marketCapMin: string;
  marketCapMax: string;
  shinyoBairitsuMax: string;
}

const INITIAL_CRITERIA: Criteria = {
  q: "", sector: "", market: "",
  perMax: "", pbrMax: "", dyMin: "",
  marketCapMin: "", marketCapMax: "",
  shinyoBairitsuMax: "",
};

export function useScreening() {
  const [criteria, setCriteria] = useState<Criteria>(INITIAL_CRITERIA);
  const [results, setResults] = useState<Stock[] | null>(null);
  const [searching, setSearching] = useState(false);

  function set(field: keyof Criteria) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setCriteria((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function screen() {
    setSearching(true);
    try {
      const params: Record<string, string> = { limit: "200" };
      (Object.entries(criteria) as [string, string][]).forEach(([k, v]) => {
        if (v) params[k] = v;
      });
      setResults(await searchStocks(params));
    } finally {
      setSearching(false);
    }
  }

  function reset() {
    setCriteria(INITIAL_CRITERIA);
    setResults(null);
  }

  return { criteria, set, results, searching, screen, reset };
}
