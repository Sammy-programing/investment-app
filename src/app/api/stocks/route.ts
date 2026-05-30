import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const p = new URL(req.url).searchParams;
  const q = p.get("q") ?? "";
  const sector = p.get("sector") ?? "";
  const market = p.get("market") ?? "";
  const perMax = p.get("perMax") ? parseFloat(p.get("perMax")!) : undefined;
  const pbrMax = p.get("pbrMax") ? parseFloat(p.get("pbrMax")!) : undefined;
  const dyMin = p.get("dyMin") ? parseFloat(p.get("dyMin")!) : undefined;
  const marketCapMin = p.get("marketCapMin") ? parseFloat(p.get("marketCapMin")!) : undefined;
  const marketCapMax = p.get("marketCapMax") ? parseFloat(p.get("marketCapMax")!) : undefined;
  const shinyoBairitsuMax = p.get("shinyoBairitsuMax") ? parseFloat(p.get("shinyoBairitsuMax")!) : undefined;
  const limit = Math.min(parseInt(p.get("limit") ?? "100"), 500);

  const stocks = await prisma.stock.findMany({
    where: {
      AND: [
        q ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { ticker: { contains: q, mode: "insensitive" } },
          ],
        } : {},
        sector ? { sector } : {},
        market ? { market } : {},
        perMax != null ? { per: { lte: perMax, not: null } } : {},
        pbrMax != null ? { pbr: { lte: pbrMax, not: null } } : {},
        dyMin != null ? { dividendYield: { gte: dyMin, not: null } } : {},
        marketCapMin != null ? { marketCap: { gte: marketCapMin, not: null } } : {},
        marketCapMax != null ? { marketCap: { lte: marketCapMax, not: null } } : {},
        shinyoBairitsuMax != null ? { shinyoBairitsu: { lte: shinyoBairitsuMax, not: null } } : {},
      ],
    },
    orderBy: { marketCap: "desc" },
    take: limit,
  });

  return NextResponse.json(stocks);
}
