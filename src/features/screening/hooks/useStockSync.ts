// src/features/screening/hooks/useStockSync.ts
import { useState, useRef } from "react";
import { seedNikkei225, getSyncCount, syncStocks, importStocksCsv } from "@/services/stocksApi";

interface SyncState {
  jobId?: string;
  running: boolean;
  processed: number;
  total: number;
  failed: number;
  done: boolean;
}

const INITIAL_SYNC: SyncState = { running: false, processed: 0, total: 0, failed: 0, done: false };

export function useStockSync() {
  const [sync, setSync] = useState<SyncState>(INITIAL_SYNC);
  const [seeding, setSeeding] = useState(false);
  const [seedDone, setSeedDone] = useState(false);
  const [importing, setImporting] = useState(false);
  const syncRef = useRef(false);

  async function seed() {
    setSeeding(true);
    try {
      const d = await seedNikkei225();
      setSeedDone(true);
      alert(`日経225 ${d.seeded}銘柄をDBに登録しました。`);
    } finally {
      setSeeding(false);
    }
  }

  async function start() {
    if (syncRef.current) return;
    syncRef.current = true;

    const countData = await getSyncCount();
    let jobId: string | undefined = undefined;
    setSync({ running: true, processed: 0, total: countData.total ?? 0, failed: 0, done: false });

    while (syncRef.current) {
      const data = await syncStocks(jobId);
      jobId = data.jobId;
      setSync({
        running: !data.done,
        jobId,
        processed: data.processed ?? 0,
        total: data.total ?? 0,
        failed: data.failed ?? 0,
        done: data.done,
      });
      if (data.done) { syncRef.current = false; break; }
    }
  }

  function stop() {
    syncRef.current = false;
    setSync((p) => ({ ...p, running: false }));
  }

  async function importCsv(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const d = await importStocksCsv(text);
      if (d.error) alert(d.error);
      else alert(`${d.imported}銘柄を取り込みました。`);
    } finally {
      setImporting(false);
    }
  }

  return { sync, start, stop, seeding, seedDone, seed, importing, importCsv };
}
