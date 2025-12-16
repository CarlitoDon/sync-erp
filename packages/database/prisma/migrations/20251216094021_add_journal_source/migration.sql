/*
  Warnings:

  - A unique constraint covering the columns `[companyId,sourceType,sourceId]` on the table `JournalEntry` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "JournalSourceType" AS ENUM ('INVOICE', 'BILL', 'PAYMENT', 'CREDIT_NOTE', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "sourceType" "JournalSourceType";

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_companyId_sourceType_sourceId_key" ON "JournalEntry"("companyId", "sourceType", "sourceId");
