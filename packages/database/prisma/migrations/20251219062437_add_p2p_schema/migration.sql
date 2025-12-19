-- CreateEnum
CREATE TYPE "SequenceType" AS ENUM ('PO', 'GRN', 'BILL', 'PAY');

-- DropIndex
DROP INDEX "SystemConfig_companyId_key_key";

-- AlterTable
ALTER TABLE "GoodsReceipt" ADD COLUMN     "receivedBy" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paymentTermsString" TEXT,
ADD COLUMN     "supplierInvoiceNumber" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "DocumentSequence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "SequenceType" NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "lastSequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentSequence_companyId_idx" ON "DocumentSequence"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSequence_companyId_type_year_month_key" ON "DocumentSequence"("companyId", "type", "year", "month");

-- AddForeignKey
ALTER TABLE "DocumentSequence" ADD CONSTRAINT "DocumentSequence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
