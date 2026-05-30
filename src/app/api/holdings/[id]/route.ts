// src/app/api/holdings/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { quantity, purchasePrice, purchaseDate } = await req.json();

  const holding = await prisma.holding.update({
    where: { id },
    data: {
      quantity,
      purchasePrice,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
    },
    include: { stock: true },
  });

  return NextResponse.json({
    id: holding.id,
    stockId: holding.stockId,
    name: holding.stock.name,
    ticker: holding.stock.ticker,
    sector: holding.stock.sector ?? "",
    quantity: holding.quantity,
    purchasePrice: holding.purchasePrice,
    purchaseDate: holding.purchaseDate?.toISOString() ?? null,
    currentPrice: holding.stock.currentPrice ?? 0,
    per: holding.stock.per ?? null,
    pbr: holding.stock.pbr ?? null,
    dividendYield: holding.stock.dividendYield ?? null,
    marketCap: holding.stock.marketCap ?? null,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.holding.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
