-- Track rental extensions at order-line/item level.

CREATE TABLE "RentalOrderExtensionItem" (
  "id" TEXT NOT NULL,
  "rentalOrderExtensionId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "rentalOrderItemId" TEXT,
  "rentalItemId" TEXT,
  "rentalBundleId" TEXT,
  "quantity" INTEGER NOT NULL,
  "previousEndDate" TIMESTAMP(3) NOT NULL,
  "newEndDate" TIMESTAMP(3) NOT NULL,
  "additionalDays" INTEGER NOT NULL,
  "unitPrice" DECIMAL(15, 2) NOT NULL,
  "additionalAmount" DECIMAL(15, 2) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RentalOrderExtensionItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RentalOrderExtensionItem_rentalOrderExtensionId_idx"
  ON "RentalOrderExtensionItem"("rentalOrderExtensionId");
CREATE INDEX "RentalOrderExtensionItem_companyId_idx"
  ON "RentalOrderExtensionItem"("companyId");
CREATE INDEX "RentalOrderExtensionItem_rentalOrderItemId_idx"
  ON "RentalOrderExtensionItem"("rentalOrderItemId");
CREATE INDEX "RentalOrderExtensionItem_rentalItemId_idx"
  ON "RentalOrderExtensionItem"("rentalItemId");
CREATE INDEX "RentalOrderExtensionItem_rentalBundleId_idx"
  ON "RentalOrderExtensionItem"("rentalBundleId");

ALTER TABLE "RentalOrderExtensionItem"
  ADD CONSTRAINT "RentalOrderExtensionItem_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RentalOrderExtensionItem"
  ADD CONSTRAINT "RentalOrderExtensionItem_rentalOrderExtensionId_fkey"
  FOREIGN KEY ("rentalOrderExtensionId") REFERENCES "RentalOrderExtension"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RentalOrderExtensionItem"
  ADD CONSTRAINT "RentalOrderExtensionItem_rentalOrderItemId_fkey"
  FOREIGN KEY ("rentalOrderItemId") REFERENCES "RentalOrderItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RentalOrderExtensionItem"
  ADD CONSTRAINT "RentalOrderExtensionItem_rentalItemId_fkey"
  FOREIGN KEY ("rentalItemId") REFERENCES "RentalItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RentalOrderExtensionItem"
  ADD CONSTRAINT "RentalOrderExtensionItem_rentalBundleId_fkey"
  FOREIGN KEY ("rentalBundleId") REFERENCES "RentalBundle"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
