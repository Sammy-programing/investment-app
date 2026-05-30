// src/lib/stockInitializer.ts
import { prisma } from "@/lib/prisma";
import {
  getJQuantsToken,
  fetchListedInfo,
  fetchDailyQuotes,
  fetchFinStatements,
  fetchDividend,
  getPreviousTradingDate,
  JQuantsStatement,
  JQuantsDividend,
} from "@/services/jquantsApi";
import { fetchShinyoBairitsu } from "@/services/jpxMarginApi";

// J-Quantsの5桁コード "72030" → 4桁コード "7203"
function normalizeCode(code: string): string {
  return code.length === 5 && code.endsWith("0") ? code.slice(0, 4) : code;
}

// 既存レコードの ticker を "7203.T" → "7203" に正規化
async function normalizeExistingTickers(): Promise<void> {
  await prisma.$executeRaw`UPDATE "Stock" SET ticker = REPLACE(ticker, '.T', '') WHERE ticker LIKE '%.T'`;
}

// Step 1: 銘柄リストを upsert
async function upsertListedInfo(idToken: string): Promise<void> {
  const info = await fetchListedInfo(idToken);
  const BATCH = 500;
  for (let i = 0; i < info.length; i += BATCH) {
    const batch = info.slice(i, i + BATCH);
    await prisma.$transaction(
      batch.map((s) =>
        prisma.stock.upsert({
          where: { ticker: normalizeCode(s.Code) },
          create: {
            ticker: normalizeCode(s.Code),
            name: s.CompanyName,
            sector: s.Sector33CodeName || null,
            market: s.MarketCodeName || null,
          },
          update: {
            name: s.CompanyName,
            sector: s.Sector33CodeName || null,
            market: s.MarketCodeName || null,
          },
        })
      )
    );
  }
  console.log(`[init] upserted ${info.length} stocks`);
}

// Step 2: 前日株価を更新
async function updatePrices(idToken: string): Promise<void> {
  const date = getPreviousTradingDate();
  const quotes = await fetchDailyQuotes(idToken, date);
  const BATCH = 500;
  for (let i = 0; i < quotes.length; i += BATCH) {
    const batch = quotes.slice(i, i + BATCH);
    await prisma.$transaction(
      batch
        .filter((q) => q.Close != null)
        .map((q) =>
          prisma.stock.updateMany({
            where: { ticker: normalizeCode(q.Code) },
            data: {
              currentPrice: q.Close,
              lastUpdated: new Date(),
            },
          })
        )
    );
  }
  console.log(`[init] updated prices for ${quotes.length} stocks (date: ${date})`);
}

// Step 3: 財務データを更新（EPS・純資産/株 → PER・PBR計算）
async function updateFinancials(idToken: string): Promise<void> {
  const statements = await fetchFinStatements(idToken);

  // 各銘柄の最新決算を取得
  const latest = new Map<string, JQuantsStatement>();
  for (const s of statements) {
    const code = normalizeCode(s.Code);
    const existing = latest.get(code);
    if (!existing || s.DisclosedDate > existing.DisclosedDate) {
      latest.set(code, s);
    }
  }

  // 現在株価を取得して PER/PBR を計算
  const tickers = Array.from(latest.keys());
  const stocks = await prisma.stock.findMany({
    where: { ticker: { in: tickers } },
    select: { ticker: true, currentPrice: true },
  });
  const priceMap = new Map(stocks.map((s) => [s.ticker, s.currentPrice]));

  const updates = Array.from(latest.entries()).map(([code, stmt]) => {
    const price = priceMap.get(code);
    const eps = parseFloat(stmt.EarningsPerShare);
    const bvps = parseFloat(stmt.BookValuePerShare);
    const per = price && eps > 0 ? parseFloat((price / eps).toFixed(2)) : null;
    const pbr = price && bvps > 0 ? parseFloat((price / bvps).toFixed(2)) : null;
    return prisma.stock.updateMany({
      where: { ticker: code },
      data: { per, pbr, eps: isNaN(eps) ? null : eps },
    });
  });

  const BATCH = 500;
  for (let i = 0; i < updates.length; i += BATCH) {
    await prisma.$transaction(updates.slice(i, i + BATCH));
  }
  console.log(`[init] updated financials for ${latest.size} stocks`);
}

// Step 4: 配当利回りを更新
async function updateDividends(idToken: string): Promise<void> {
  const dividends = await fetchDividend(idToken);

  // 各銘柄の最新配当を取得
  const latest = new Map<string, JQuantsDividend>();
  for (const d of dividends) {
    const code = normalizeCode(d.Code);
    const existing = latest.get(code);
    if (!existing || d.ReferenceDate > existing.ReferenceDate) {
      latest.set(code, d);
    }
  }

  const tickers = Array.from(latest.keys());
  const stocks = await prisma.stock.findMany({
    where: { ticker: { in: tickers } },
    select: { ticker: true, currentPrice: true },
  });
  const priceMap = new Map(stocks.map((s) => [s.ticker, s.currentPrice]));

  const updates = Array.from(latest.entries()).map(([code, div]) => {
    const price = priceMap.get(code);
    const annual = parseFloat(div.AnnualDividendPerShare);
    const dy = price && annual > 0 ? parseFloat(((annual / price) * 100).toFixed(2)) : null;
    return prisma.stock.updateMany({
      where: { ticker: code },
      data: { dividendYield: dy },
    });
  });

  const BATCH = 500;
  for (let i = 0; i < updates.length; i += BATCH) {
    await prisma.$transaction(updates.slice(i, i + BATCH));
  }
  console.log(`[init] updated dividends for ${latest.size} stocks`);
}

// Step 5: 信用倍率を更新
async function updateMargin(): Promise<void> {
  const marginMap = await fetchShinyoBairitsu();
  const entries = Array.from(marginMap.entries());

  const BATCH = 500;
  for (let i = 0; i < entries.length; i += BATCH) {
    await prisma.$transaction(
      entries.slice(i, i + BATCH).map(([code, ratio]) =>
        prisma.stock.updateMany({
          where: { ticker: code },
          data: { shinyoBairitsu: ratio },
        })
      )
    );
  }
  console.log(`[init] updated shinyo-bairitsu for ${entries.length} stocks`);
}

export async function initializeStockData(): Promise<void> {
  console.log("[init] starting stock data initialization...");

  // 既存 ticker を正規化（"7203.T" → "7203"）
  await normalizeExistingTickers();

  const idToken = await getJQuantsToken();

  await upsertListedInfo(idToken);
  await updatePrices(idToken);
  await updateFinancials(idToken);
  await updateDividends(idToken);
  await updateMargin();

  console.log("[init] stock data initialization complete");
}
