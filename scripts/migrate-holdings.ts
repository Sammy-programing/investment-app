// scripts/migrate-holdings.ts
import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

dotenv.config({ path: ".env.local" });

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

  const holdings = await prisma.holding.findMany();
  console.log(`Processing ${holdings.length} holdings...`);

  for (const h of holdings) {
    const stock = await prisma.stock.upsert({
      where: { ticker: h.ticker },
      create: {
        ticker: h.ticker,
        name: h.name,
        sector: h.sector || null,
        currentPrice: h.currentPrice,
      },
      update: {},
    });
    await prisma.holding.update({
      where: { id: h.id },
      data: { stockId: stock.id },
    });
    console.log(`  Linked ${h.ticker} (holding ${h.id}) → stock ${stock.id}`);
  }

  const deleted = await prisma.syncJob.deleteMany();
  console.log(`Deleted ${deleted.count} SyncJob record(s).`);

  await prisma.$disconnect();
  console.log("Migration complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
