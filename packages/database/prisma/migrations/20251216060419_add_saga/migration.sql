-- CreateEnum
CREATE TYPE "SagaType" AS ENUM ('INVOICE_POST', 'SHIPMENT', 'GOODS_RECEIPT', 'BILL_POST', 'PAYMENT_POST', 'CREDIT_NOTE', 'STOCK_TRANSFER', 'STOCK_RETURN');

-- CreateEnum
CREATE TYPE "SagaStep" AS ENUM ('PENDING', 'STOCK_DONE', 'BALANCE_DONE', 'JOURNAL_DONE', 'COMPLETED', 'FAILED', 'COMPENSATION_FAILED');

-- CreateTable
CREATE TABLE "SagaLog" (
    "id" TEXT NOT NULL,
    "sagaType" "SagaType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "step" "SagaStep" NOT NULL,
    "stepData" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SagaLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SagaLog_entityId_idx" ON "SagaLog"("entityId");

-- CreateIndex
CREATE INDEX "SagaLog_companyId_sagaType_step_idx" ON "SagaLog"("companyId", "sagaType", "step");
