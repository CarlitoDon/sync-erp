/*
  Warnings:

  - The `paymentTerms` column on the `Order` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "PaymentTerms" AS ENUM ('NET_30', 'PARTIAL', 'UPFRONT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID_UPFRONT', 'SETTLED');

-- AlterEnum
ALTER TYPE "AuditLogAction" ADD VALUE 'SHIPMENT_VOIDED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'PARTIALLY_SHIPPED';
ALTER TYPE "OrderStatus" ADD VALUE 'SHIPPED';

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_invoiceId_fkey";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paidAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paymentStatus" "PaymentStatus",
DROP COLUMN "paymentTerms",
ADD COLUMN     "paymentTerms" "PaymentTerms" NOT NULL DEFAULT 'NET_30';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "paymentType" TEXT NOT NULL DEFAULT 'INVOICE',
ADD COLUMN     "settledAt" TIMESTAMP(3),
ADD COLUMN     "settlementBillId" TEXT,
ALTER COLUMN "invoiceId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_paymentType_idx" ON "Payment"("paymentType");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
