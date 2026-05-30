import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NIKKEI225 } from "@/data/nikkei225";

export async function POST() {
  const results = await prisma.$transaction(
    NIKKEI225.map((s) =>
      prisma.stock.upsert({
        where: { ticker: s.ticker },
        update: { name: s.name, sector: s.sector, market: s.market },
        create: { ticker: s.ticker, name: s.name, sector: s.sector, market: s.market },
      })
    )
  );

  return NextResponse.json({ seeded: results.length });
}
