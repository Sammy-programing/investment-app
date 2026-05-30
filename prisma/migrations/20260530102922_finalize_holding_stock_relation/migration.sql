/*
  Warnings:

  - You are about to drop the column `currentPrice` on the `Holding` table. All the data in the column will be lost.
  - You are about to drop the column `dividendYield` on the `Holding` table. All the data in the column will be lost.
  - You are about to drop the column `marketCap` on the `Holding` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Holding` table. All the data in the column will be lost.
  - You are about to drop the column `pbr` on the `Holding` table. All the data in the column will be lost.
  - You are about to drop the column `per` on the `Holding` table. All the data in the column will be lost.
  - You are about to drop the column `sector` on the `Holding` table. All the data in the column will be lost.
  - You are about to drop the column `ticker` on the `Holding` table. All the data in the column will be lost.
  - The `status` column on the `SyncJob` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Made the column `stockId` on table `Holding` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- DropForeignKey
ALTER TABLE "Holding" DROP CONSTRAINT "Holding_stockId_fkey";

-- AlterTable
ALTER TABLE "Holding" DROP COLUMN "currentPrice",
DROP COLUMN "dividendYield",
DROP COLUMN "marketCap",
DROP COLUMN "name",
DROP COLUMN "pbr",
DROP COLUMN "per",
DROP COLUMN "sector",
DROP COLUMN "ticker",
ALTER COLUMN "stockId" SET NOT NULL;

-- AlterTable
ALTER TABLE "SyncJob" DROP COLUMN "status",
ADD COLUMN     "status" "SyncStatus" NOT NULL DEFAULT 'PENDING';

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
