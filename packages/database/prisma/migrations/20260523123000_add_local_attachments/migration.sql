CREATE TYPE "AttachmentEntityType" AS ENUM (
  'BILL',
  'INVOICE',
  'PURCHASE_ORDER',
  'SALES_ORDER',
  'GOODS_RECEIPT',
  'SHIPMENT',
  'PAYMENT',
  'EXPENSE',
  'RENTAL_ORDER',
  'RENTAL_ITEM',
  'PRODUCT',
  'PARTNER'
);

CREATE TABLE "Attachment" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "entityType" "AttachmentEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "checksumSha256" TEXT NOT NULL,
  "storageProvider" TEXT NOT NULL DEFAULT 'local',
  "storageKey" TEXT NOT NULL,
  "uploadedByUserId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Attachment_storageKey_key" ON "Attachment"("storageKey");
CREATE INDEX "Attachment_companyId_entityType_entityId_idx" ON "Attachment"("companyId", "entityType", "entityId");
CREATE INDEX "Attachment_companyId_createdAt_idx" ON "Attachment"("companyId", "createdAt");
CREATE INDEX "Attachment_uploadedByUserId_idx" ON "Attachment"("uploadedByUserId");

ALTER TABLE "Attachment"
ADD CONSTRAINT "Attachment_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attachment"
ADD CONSTRAINT "Attachment_uploadedByUserId_fkey"
FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
