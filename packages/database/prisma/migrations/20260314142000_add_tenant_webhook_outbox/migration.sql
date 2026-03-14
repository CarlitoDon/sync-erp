-- CreateEnum
CREATE TYPE "TenantWebhookOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED', 'DEAD_LETTER');

-- CreateTable
CREATE TABLE "TenantWebhookOutbox" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "apiKeyId" TEXT,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "webhookSecret" TEXT,
    "eventTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "TenantWebhookOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastStatusCode" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantWebhookOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantWebhookOutbox_companyId_createdAt_idx" ON "TenantWebhookOutbox"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "TenantWebhookOutbox_status_nextAttemptAt_idx" ON "TenantWebhookOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "TenantWebhookOutbox_companyId_status_nextAttemptAt_idx" ON "TenantWebhookOutbox"("companyId", "status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "TenantWebhookOutbox_event_status_nextAttemptAt_idx" ON "TenantWebhookOutbox"("event", "status", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "TenantWebhookOutbox" ADD CONSTRAINT "TenantWebhookOutbox_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantWebhookOutbox" ADD CONSTRAINT "TenantWebhookOutbox_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
