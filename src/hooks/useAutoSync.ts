import { useState, useEffect, useCallback } from "react";
import { getSyncCount, syncStocks } from "@/services/stocksApi";

export interface SyncProgress {
  processed: number;
  total: number;
}

export function useAutoSync() {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress>({ processed: 0, total: 0 });

  const runSync = useCallback(async () => {
    try {
      const { total } = await getSyncCount();
      if (total === 0) return;

      setSyncing(true);
      setProgress({ processed: 0, total });

      let jobId: string | undefined;
      while (true) {
        const data = await syncStocks(jobId);
        jobId = data.jobId;
        setProgress({ processed: data.processed, total: data.total || total });
        if (data.done) break;
      }
    } catch {
      // エラー時は静かに停止
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    runSync();
  }, [runSync]);

  return { syncing, progress };
}
