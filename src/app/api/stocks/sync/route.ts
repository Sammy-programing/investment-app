import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const BATCH_SIZE = 10;
// 参考: https://algo-trading.tokyo/python-yfinance-api-limit/
// 10銘柄以上は3〜5秒推奨。429ブロックは数時間〜数日続くため保守的に設定。
const INTERVAL_MS = 3000;
// 429等のエラー時はバックオフリトライ: 10秒 → 20秒 → 30秒
const RETRY_DELAYS_MS = [10_000, 20_000, 30_000];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const pendingWhere = (cutoff: Date) => ({
  OR: [
    { lastUpdated: null },
    { lastUpdated: { lt: cutoff } },
  ],
});

// GET: 同期待ち件数を返す
export async function GET() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const total = await prisma.stock.count({ where: pendingWhere(cutoff) });
  return NextResponse.json({ total });
}

// POST: 次のバッチを処理（バックオフリトライ付き）
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const jobId: string | undefined = body.jobId;

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const targets = await prisma.stock.findMany({
    where: pendingWhere(cutoff),
    take: BATCH_SIZE,
    orderBy: { lastUpdated: "asc" },
    select: { id: true, ticker: true },
  });

  const remaining = await prisma.stock.count({ where: pendingWhere(cutoff) });

  if (targets.length === 0) {
    if (jobId) {
      await prisma.syncJob.update({
        where: { id: jobId },
        data: { status: "completed", completedAt: new Date() },
      });
    }
    return NextResponse.json({ done: true, remaining: 0, processed: 0, total: 0, failed: 0, jobId });
  }

  let job;
  if (jobId) {
    job = await prisma.syncJob.update({
      where: { id: jobId },
      data: { status: "running" },
    });
  } else {
    const total = await prisma.stock.count();
    job = await prisma.syncJob.create({
      data: { status: "running", total },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const yahooFinance = (await import("yahoo-finance2")).default as any;
  let processed = 0;
  let failed = 0;

  for (const stock of targets) {
    let success = false;
    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length + 1; attempt++) {
      try {
        const quote = await yahooFinance.quote(stock.ticker);
        await prisma.stock.update({
          where: { id: stock.id },
          data: {
            currentPrice: quote.regularMarketPrice ?? null,
            per: quote.trailingPE ?? null,
            pbr: quote.priceToBook ?? null,
            dividendYield: quote.dividendYield ? quote.dividendYield * 100 : null,
            marketCap: quote.marketCap ?? null,
            eps: quote.epsTrailingTwelveMonths ?? null,
            lastUpdated: new Date(),
          },
        });
        success = true;
        break;
      } catch {
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]);
        }
      }
    }
    if (!success) failed++;
    await sleep(INTERVAL_MS);
  }

  const totalProcessed = (job as { processed: number }).processed + processed;
  const totalFailed = (job as { failed: number }).failed + failed;
  const newRemaining = remaining - targets.length;

  await prisma.syncJob.update({
    where: { id: job.id },
    data: {
      processed: totalProcessed,
      failed: totalFailed,
      status: newRemaining <= 0 ? "completed" : "running",
      completedAt: newRemaining <= 0 ? new Date() : null,
    },
  });

  return NextResponse.json({
    done: newRemaining <= 0,
    remaining: Math.max(0, newRemaining),
    processed: totalProcessed,
    failed: totalFailed,
    total: job.total,
    jobId: job.id,
  });
}
