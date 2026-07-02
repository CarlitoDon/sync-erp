-- CreateEnum
CREATE TYPE "CompanyOnboardingStatus" AS ENUM ('NOT_INITIALIZED', 'IN_PROGRESS', 'ACTIVE');

-- CreateEnum
CREATE TYPE "CompanyOnboardingStep" AS ENUM ('WELCOME', 'BUSINESS_SHAPE', 'CONFIGURE_SYSTEM', 'OPENING_BALANCE', 'FIRST_TRANSACTION', 'ALIVE_MOMENT', 'DONE');

-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('CASH', 'BANK', 'QRIS', 'EWALLET', 'OTHER');

-- AlterEnum
ALTER TYPE "AuditLogAction" ADD VALUE 'RENTAL_ORDER_EXTENDED';

-- AlterTable
ALTER TABLE "Company"
  ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3),
  ADD COLUMN "onboardingMeta" JSONB,
  ADD COLUMN "onboardingStatus" "CompanyOnboardingStatus" NOT NULL DEFAULT 'NOT_INITIALIZED',
  ADD COLUMN "onboardingStep" "CompanyOnboardingStep" NOT NULL DEFAULT 'WELCOME';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "methodNew" "PaymentMethodType";

UPDATE "Payment"
SET "methodNew" = (
  CASE "method"::TEXT
    WHEN 'CASH' THEN 'CASH'
    WHEN 'BANK_TRANSFER' THEN 'BANK'
    ELSE 'OTHER'
  END
)::"PaymentMethodType";

ALTER TABLE "Payment" ALTER COLUMN "methodNew" SET NOT NULL;
ALTER TABLE "Payment" DROP COLUMN "method";
ALTER TABLE "Payment" RENAME COLUMN "methodNew" TO "method";

-- DropEnum
DROP TYPE "PaymentMethod";

-- CreateTable
CREATE TABLE "CompanyPaymentMethod" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PaymentMethodType" NOT NULL,
    "accountId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyPaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyPaymentMethod_companyId_idx" ON "CompanyPaymentMethod"("companyId");

-- CreateIndex
CREATE INDEX "CompanyPaymentMethod_companyId_isActive_idx" ON "CompanyPaymentMethod"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyPaymentMethod_companyId_code_key" ON "CompanyPaymentMethod"("companyId", "code");

-- AddForeignKey
ALTER TABLE "CompanyPaymentMethod" ADD CONSTRAINT "CompanyPaymentMethod_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPaymentMethod" ADD CONSTRAINT "CompanyPaymentMethod_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
