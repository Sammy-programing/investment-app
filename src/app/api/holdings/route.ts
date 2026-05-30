// src/app/api/holdings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function flattenHolding(h: {
  id: string;
  stockId: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate: Date | null;
  stock: {
    name: string;
    ticker: string;
    sector: string | null;
    currentPrice: number | null;
    per: number | null;
    pbr: number | null;
    dividendYield: number | null;
    marketCap: number | null;
  };
}) {
  return {
    id: h.id,
    stockId: h.stockId,
    name: h.stock.name,
    ticker: h.stock.ticker,
    sector: h.stock.sector ?? "",
    quantity: h.quantity,
    purchasePrice: h.purchasePrice,
    purchaseDate: h.purchaseDate?.toISOString() ?? null,
    currentPrice: h.stock.currentPrice ?? 0,
    per: h.stock.per ?? null,
    pbr: h.stock.pbr ?? null,
    dividendYield: h.stock.dividendYield ?? null,
    marketCap: h.stock.marketCap ?? null,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const sector = searchParams.get("sector") ?? "";

  const holdings = await prisma.holding.findMany({
    include: { stock: true },
    where: {
      AND: [
        q
          ? {
              OR: [
                { stock: { name: { contains: q, mode: "insensitive" } } },
                { stock: { ticker: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {},
        sector ? { stock: { sector } } : {},
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(holdings.map(flattenHolding));
}

export async function POST(req: NextRequest) {
  const { stockId, quantity, purchasePrice, purchaseDate } = await req.json();

  const stockExists = await prisma.stock.findUnique({ where: { id: stockId } });
  if (!stockExists) {
    return NextResponse.json({ error: "Stock not found" }, { status: 404 });
  }

  const holding = await prisma.holding.create({
    data: {
      stockId,
      quantity,
      purchasePrice,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
    },
    include: { stock: true },
  });

  return NextResponse.json(flattenHolding(holding), { status: 201 });
}
