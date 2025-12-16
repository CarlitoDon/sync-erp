-- CreateEnum
CREATE TYPE "IdempotencyScope" AS ENUM ('INVOICE_POST', 'PAYMENT_CREATE');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- AlterEnum
ALTER TYPE "InvoiceType" ADD VALUE 'CREDIT_NOTE';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "relatedInvoiceId" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "cost" DECIMAL(15,2);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "scope" "IdempotencyScope" NOT NULL,
    "status" "IdempotencyStatus" NOT NULL,
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdempotencyKey_companyId_idx" ON "IdempotencyKey"("companyId");

-- CreateIndex
CREATE INDEX "IdempotencyKey_status_updatedAt_idx" ON "IdempotencyKey"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_relatedInvoiceId_fkey" FOREIGN KEY ("relatedInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
