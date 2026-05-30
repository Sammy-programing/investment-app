import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const sector = searchParams.get("sector") ?? "";

  const holdings = await prisma.holding.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { ticker: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        sector ? { sector } : {},
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(holdings);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const holding = await prisma.holding.create({ data: body });
  return NextResponse.json(holding, { status: 201 });
}
