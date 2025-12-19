-- CreateEnum
CREATE TYPE "AuditLogAction" AS ENUM ('INVOICE_POSTED', 'BILL_POSTED', 'PAYMENT_RECORDED', 'ORDER_CONFIRMED', 'GOODS_RECEIVED', 'SHIPMENT_CREATED');

-- AlterTable
ALTER TABLE "SagaLog" ADD COLUMN     "correlationId" TEXT;

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "AuditLogAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "businessDate" TIMESTAMP(3) NOT NULL,
    "payloadSnapshot" JSONB,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_companyId_action_idx" ON "AuditLog"("companyId", "action");

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- CreateIndex
CREATE INDEX "AuditLog_businessDate_idx" ON "AuditLog"("businessDate");

-- CreateIndex
CREATE INDEX "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");

-- CreateIndex
CREATE INDEX "SagaLog_correlationId_idx" ON "SagaLog"("correlationId");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
