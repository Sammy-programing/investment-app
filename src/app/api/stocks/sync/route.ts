import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const BATCH_SIZE = 10;
const RATE_LIMIT_MS = 200; // Yahoo Finance レートリミット対策

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// GET: 同期ジョブの状態を取得
export async function GET(req: NextRequest) {
  const jobId = new URL(req.url).searchParams.get("jobId");
  if (jobId) {
    const job = await prisma.syncJob.findUnique({ where: { id: jobId } });
    return NextResponse.json(job);
  }
  const latest = await prisma.syncJob.findFirst({ orderBy: { startedAt: "desc" } });
  return NextResponse.json(latest);
}

// POST: 次のバッチを処理
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const jobId: string | undefined = body.jobId;

  // lastUpdatedが24時間以上前 or null の銘柄を対象にする
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const targets = await prisma.stock.findMany({
    where: {
      OR: [{ lastUpdated: null }, { lastUpdated: { lt: cutoff } }],
    },
    take: BATCH_SIZE,
    orderBy: { lastUpdated: "asc" },
    select: { id: true, ticker: true },
  });

  // 残件数（処理前）
  const remaining = await prisma.stock.count({
    where: {
      OR: [{ lastUpdated: null }, { lastUpdated: { lt: cutoff } }],
    },
  });

  if (targets.length === 0) {
    if (jobId) {
      await prisma.syncJob.update({
        where: { id: jobId },
        data: { status: "completed", completedAt: new Date() },
      });
    }
    return NextResponse.json({ done: true, remaining: 0, jobId });
  }

  // ジョブ作成 or 更新
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
      processed++;
    } catch {
      failed++;
    }
    await sleep(RATE_LIMIT_MS);
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
    jobId: job.id,
  });
}
