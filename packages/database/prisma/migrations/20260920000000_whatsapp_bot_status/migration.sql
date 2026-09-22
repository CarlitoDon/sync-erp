-- CreateTable
CREATE TABLE "WhatsappBotStatus" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "status" TEXT NOT NULL DEFAULT 'INITIALIZING',
    "qr" TEXT,
    "lastError" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "lastAlertedAt" TIMESTAMP(3),
    "lastAlertState" TEXT,
    "aiSalesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappBotStatus_pkey" PRIMARY KEY ("id")
);
