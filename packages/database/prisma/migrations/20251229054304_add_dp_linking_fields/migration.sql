-- AlterEnum
ALTER TYPE "InvoiceType" ADD VALUE 'DEBIT_NOTE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SequenceType" ADD VALUE 'SHP';
ALTER TYPE "SequenceType" ADD VALUE 'DN';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "dpBillId" TEXT,
ADD COLUMN     "isDownPayment" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_dpBillId_fkey" FOREIGN KEY ("dpBillId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
