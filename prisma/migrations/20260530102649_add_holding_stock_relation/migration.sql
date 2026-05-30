-- AlterTable
ALTER TABLE "Holding" ADD COLUMN     "purchaseDate" TIMESTAMP(3),
ADD COLUMN     "stockId" TEXT;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
