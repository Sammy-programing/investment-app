import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yahooFinance = (await import("yahoo-finance2")).default as any;
    const quote = await yahooFinance.quote(ticker);
    return NextResponse.json({
      currentPrice: quote.regularMarketPrice ?? 0,
      per: quote.trailingPE ?? null,
      pbr: quote.priceToBook ?? null,
      dividendYield: quote.dividendYield ? quote.dividendYield * 100 : null,
      marketCap: quote.marketCap ?? null,
      name: quote.longName ?? quote.shortName ?? ticker,
    });
  } catch {
    return NextResponse.json({ error: "取得失敗" }, { status: 404 });
  }
}
