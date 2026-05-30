import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.length < 1) return NextResponse.json([]);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yahooFinance = (await import("yahoo-finance2")).default as any;
    const result = await yahooFinance.search(q, { newsCount: 0 });
    const quotes = ((result.quotes ?? []) as any[])
      .filter((r) => r.quoteType === "EQUITY" || r.quoteType === "ETF")
      .slice(0, 8)
      .map((r) => ({
        ticker: r.symbol,
        name: r.shortname ?? r.longname ?? r.symbol,
        exchange: r.exchange,
      }));
    return NextResponse.json(quotes);
  } catch {
    return NextResponse.json([]);
  }
}
