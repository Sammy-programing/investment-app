// src/services/jpxMarginApi.ts
import { decode } from "iconv-lite";

const INDEX_URL = "https://www.jpx.co.jp/markets/statistics-equities/margin/index.html";
const JPX_BASE = "https://www.jpx.co.jp";

async function getLatestMarginCsvUrl(): Promise<string> {
  const res = await fetch(INDEX_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; investment-app/1.0)" },
  });
  if (!res.ok) throw new Error(`JPX margin index fetch failed: ${res.status}`);
  const html = await res.text();

  // ページ内の最初の .csv リンクを取得
  const match = html.match(/href="([^"]+\.csv)"/i);
  if (!match) throw new Error("JPX margin CSV link not found");
  const path = match[1];
  return path.startsWith("http") ? path : `${JPX_BASE}${path}`;
}

export async function fetchShinyoBairitsu(): Promise<Map<string, number>> {
  const csvUrl = await getLatestMarginCsvUrl();

  const res = await fetch(csvUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; investment-app/1.0)" },
  });
  if (!res.ok) throw new Error(`JPX margin CSV fetch failed: ${res.status}`);

  const buffer = await res.arrayBuffer();
  const text = decode(Buffer.from(buffer), "shift-jis");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // ヘッダー行をスキップ（コードが4桁数字の行だけを処理）
  const result = new Map<string, number>();

  for (const line of lines) {
    const cols = line.split(",").map((c) => c.trim().replace(/"/g, ""));
    const code = cols[0];
    if (!/^\d{4}$/.test(code)) continue; // 4桁コード以外はスキップ

    // 信用倍率は col[6]。信用買残(col[2]) / 信用売残(col[4]) でも計算可能
    const directRatio = parseFloat(cols[6]);
    if (!isNaN(directRatio) && directRatio > 0) {
      result.set(code, directRatio);
      continue;
    }
    // col[6] が無効な場合は計算
    const buy = parseFloat(cols[2]);
    const sell = parseFloat(cols[4]);
    if (!isNaN(buy) && !isNaN(sell) && sell > 0) {
      result.set(code, parseFloat((buy / sell).toFixed(2)));
    }
  }

  return result;
}
