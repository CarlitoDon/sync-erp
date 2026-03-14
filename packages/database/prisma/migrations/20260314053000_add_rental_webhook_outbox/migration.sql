-- CreateEnum
CREATE TYPE "RentalWebhookDeliveryType" AS ENUM ('NEW_ORDER', 'PAYMENT_STATUS');

-- CreateEnum
CREATE TYPE "RentalWebhookOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED', 'DEAD_LETTER');

-- CreateTable
CREATE TABLE "RentalWebhookOutbox" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "deliveryType" "RentalWebhookDeliveryType" NOT NULL,
    "orderPublicToken" TEXT NOT NULL,
    "orderNumber" TEXT,
    "payload" JSONB NOT NULL,
    "autoRetry" BOOLEAN NOT NULL DEFAULT true,
    "status" "RentalWebhookOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastStatusCode" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalWebhookOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RentalWebhookOutbox_companyId_createdAt_idx" ON "RentalWebhookOutbox"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "RentalWebhookOutbox_status_nextAttemptAt_idx" ON "RentalWebhookOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "RentalWebhookOutbox_deliveryType_status_nextAttemptAt_idx" ON "RentalWebhookOutbox"("deliveryType", "status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "RentalWebhookOutbox_orderPublicToken_idx" ON "RentalWebhookOutbox"("orderPublicToken");

-- AddForeignKey
ALTER TABLE "RentalWebhookOutbox" ADD CONSTRAINT "RentalWebhookOutbox_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
