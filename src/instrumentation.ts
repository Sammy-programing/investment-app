// src/instrumentation.ts
export async function register() {
  // Node.js ランタイムでのみ実行（Edge Runtime では実行しない）
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // 環境変数未設定の場合はスキップ（開発環境での任意実行）
  if (!process.env.JQUANTS_EMAIL || !process.env.JQUANTS_PASSWORD) {
    console.log("[init] JQUANTS_EMAIL/PASSWORD not set, skipping stock initialization");
    return;
  }

  try {
    const { initializeStockData } = await import("@/lib/stockInitializer");
    await initializeStockData();
  } catch (e) {
    // エラーでサーバー起動を止めない
    console.error("[init] stock initialization failed:", e);
  }
}
