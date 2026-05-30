import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// JPX上場銘柄一覧CSVの取り込み
// フォーマット: コード,銘柄名,市場区分,33業種区分,...
export async function POST(req: NextRequest) {
  const text = await req.text();
  const lines = text.split("\n").filter(Boolean);

  // ヘッダー行をスキップ（"コード"を含む行を探す）
  const headerIdx = lines.findIndex((l) => l.includes("コード") || l.includes("code") || l.includes("Code"));
  const dataLines = headerIdx >= 0 ? lines.slice(headerIdx + 1) : lines.slice(1);

  const stocks = dataLines
    .map((line) => {
      // CSV or タブ区切りに対応
      const cols = line.includes("\t") ? line.split("\t") : line.split(",");
      const code = cols[0]?.trim().replace(/"/g, "");
      const name = cols[1]?.trim().replace(/"/g, "");
      const market = cols[2]?.trim().replace(/"/g, "") ?? "";
      const sector = cols[3]?.trim().replace(/"/g, "") ?? "";

      if (!code || !name || !/^\d{4}$/.test(code)) return null;
      return { ticker: `${code}.T`, name, market, sector };
    })
    .filter(Boolean) as { ticker: string; name: string; market: string; sector: string }[];

  if (stocks.length === 0) {
    return NextResponse.json({ error: "有効なデータが見つかりません。フォーマットを確認してください。" }, { status: 400 });
  }

  const results = await prisma.$transaction(
    stocks.map((s) =>
      prisma.stock.upsert({
        where: { ticker: s.ticker },
        update: { name: s.name, market: s.market, sector: s.sector },
        create: { ticker: s.ticker, name: s.name, market: s.market, sector: s.sector },
      })
    )
  );

  return NextResponse.json({ imported: results.length });
}
