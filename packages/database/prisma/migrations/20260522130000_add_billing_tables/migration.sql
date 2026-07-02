-- CreateEnum
CREATE TYPE "BillingSubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BillingProvider" AS ENUM ('MANUAL', 'STRIPE', 'XENDIT', 'MIDTRANS');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "BillingCheckoutSessionStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BillingWebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateTable
CREATE TABLE "CompanySubscription" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "planKey" TEXT NOT NULL DEFAULT 'free',
    "status" "BillingSubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "provider" "BillingProvider",
    "providerCustomerId" TEXT,
    "providerSubscriptionId" TEXT,
    "trialStartsAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodStartsAt" TIMESTAMP(3),
    "currentPeriodEndsAt" TIMESTAMP(3),
    "graceEndsAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingCheckoutSession" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL DEFAULT 'MANUAL',
    "planKey" TEXT NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "status" "BillingCheckoutSessionStatus" NOT NULL DEFAULT 'OPEN',
    "providerSessionId" TEXT,
    "providerCheckoutUrl" TEXT,
    "amountIdr" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "successUrl" TEXT,
    "cancelUrl" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingCheckoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" "BillingWebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "companyId" TEXT,
    "providerCustomerId" TEXT,
    "providerSubscriptionId" TEXT,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanySubscription_companyId_key" ON "CompanySubscription"("companyId");

-- CreateIndex
CREATE INDEX "CompanySubscription_status_idx" ON "CompanySubscription"("status");

-- CreateIndex
CREATE INDEX "CompanySubscription_planKey_idx" ON "CompanySubscription"("planKey");

-- CreateIndex
CREATE INDEX "CompanySubscription_provider_providerSubscriptionId_idx" ON "CompanySubscription"("provider", "providerSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCheckoutSession_providerSessionId_key" ON "BillingCheckoutSession"("providerSessionId");

-- CreateIndex
CREATE INDEX "BillingCheckoutSession_companyId_status_createdAt_idx" ON "BillingCheckoutSession"("companyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "BillingCheckoutSession_provider_status_createdAt_idx" ON "BillingCheckoutSession"("provider", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingWebhookEvent_provider_eventId_key" ON "BillingWebhookEvent"("provider", "eventId");

-- CreateIndex
CREATE INDEX "BillingWebhookEvent_provider_status_createdAt_idx" ON "BillingWebhookEvent"("provider", "status", "createdAt");

-- CreateIndex
CREATE INDEX "BillingWebhookEvent_companyId_createdAt_idx" ON "BillingWebhookEvent"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "CompanySubscription" ADD CONSTRAINT "CompanySubscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCheckoutSession" ADD CONSTRAINT "BillingCheckoutSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingWebhookEvent" ADD CONSTRAINT "BillingWebhookEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
