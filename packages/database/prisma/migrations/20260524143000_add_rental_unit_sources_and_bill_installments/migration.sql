-- Add rental unit acquisition/source metadata and bill installment schedules.

CREATE TYPE "BillInstallmentStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

ALTER TABLE "RentalItemUnit"
  ADD COLUMN "acquiredAt" TIMESTAMP(3),
  ADD COLUMN "acquisitionCost" DECIMAL(15, 2),
  ADD COLUMN "sourceOrderId" TEXT,
  ADD COLUMN "sourceOrderItemId" TEXT,
  ADD COLUMN "sourceFulfillmentId" TEXT,
  ADD COLUMN "sourceBillId" TEXT,
  ADD COLUMN "sourceBatchCode" TEXT,
  ADD COLUMN "sizeLabel" TEXT,
  ADD COLUMN "color" TEXT,
  ADD COLUMN "sourceNotes" TEXT;

CREATE TABLE "BillInstallmentSchedule" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "billId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(15, 2) NOT NULL,
  "status" "BillInstallmentStatus" NOT NULL DEFAULT 'PENDING',
  "paidAt" TIMESTAMP(3),
  "paymentId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BillInstallmentSchedule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillInstallmentSchedule_billId_sequence_key"
  ON "BillInstallmentSchedule"("billId", "sequence");
CREATE INDEX "BillInstallmentSchedule_companyId_billId_idx"
  ON "BillInstallmentSchedule"("companyId", "billId");
CREATE INDEX "BillInstallmentSchedule_companyId_status_idx"
  ON "BillInstallmentSchedule"("companyId", "status");
CREATE INDEX "BillInstallmentSchedule_dueDate_idx"
  ON "BillInstallmentSchedule"("dueDate");
CREATE INDEX "BillInstallmentSchedule_paymentId_idx"
  ON "BillInstallmentSchedule"("paymentId");

CREATE INDEX "RentalItemUnit_sourceOrderId_idx"
  ON "RentalItemUnit"("sourceOrderId");
CREATE INDEX "RentalItemUnit_sourceOrderItemId_idx"
  ON "RentalItemUnit"("sourceOrderItemId");
CREATE INDEX "RentalItemUnit_sourceFulfillmentId_idx"
  ON "RentalItemUnit"("sourceFulfillmentId");
CREATE INDEX "RentalItemUnit_sourceBillId_idx"
  ON "RentalItemUnit"("sourceBillId");
CREATE INDEX "RentalItemUnit_companyId_sourceBatchCode_idx"
  ON "RentalItemUnit"("companyId", "sourceBatchCode");

ALTER TABLE "RentalItemUnit"
  ADD CONSTRAINT "RentalItemUnit_sourceOrderId_fkey"
  FOREIGN KEY ("sourceOrderId") REFERENCES "Order"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RentalItemUnit"
  ADD CONSTRAINT "RentalItemUnit_sourceOrderItemId_fkey"
  FOREIGN KEY ("sourceOrderItemId") REFERENCES "OrderItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RentalItemUnit"
  ADD CONSTRAINT "RentalItemUnit_sourceFulfillmentId_fkey"
  FOREIGN KEY ("sourceFulfillmentId") REFERENCES "Fulfillment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RentalItemUnit"
  ADD CONSTRAINT "RentalItemUnit_sourceBillId_fkey"
  FOREIGN KEY ("sourceBillId") REFERENCES "Invoice"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillInstallmentSchedule"
  ADD CONSTRAINT "BillInstallmentSchedule_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillInstallmentSchedule"
  ADD CONSTRAINT "BillInstallmentSchedule_billId_fkey"
  FOREIGN KEY ("billId") REFERENCES "Invoice"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillInstallmentSchedule"
  ADD CONSTRAINT "BillInstallmentSchedule_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
