import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const p = new URL(req.url).searchParams;

  const perMax = p.get("perMax") ? parseFloat(p.get("perMax")!) : undefined;
  const pbrMax = p.get("pbrMax") ? parseFloat(p.get("pbrMax")!) : undefined;
  const dyMin = p.get("dyMin") ? parseFloat(p.get("dyMin")!) : undefined;
  const plMin = p.get("plMin") ? parseFloat(p.get("plMin")!) : undefined;
  const plMax = p.get("plMax") ? parseFloat(p.get("plMax")!) : undefined;
  const sector = p.get("sector") ?? undefined;

  const holdings = await prisma.holding.findMany({
    where: {
      AND: [
        sector ? { sector } : {},
        perMax != null ? { per: { lte: perMax, not: null } } : {},
        pbrMax != null ? { pbr: { lte: pbrMax, not: null } } : {},
        dyMin != null ? { dividendYield: { gte: dyMin, not: null } } : {},
      ],
    },
  });

  // 損益率フィルター (DBで計算できないためアプリ側で)
  const filtered = holdings.filter((h) => {
    const plPct = ((h.currentPrice - h.purchasePrice) / h.purchasePrice) * 100;
    if (plMin != null && plPct < plMin) return false;
    if (plMax != null && plPct > plMax) return false;
    return true;
  });

  return NextResponse.json(filtered);
}
