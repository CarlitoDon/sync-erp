ALTER TABLE "RentalOrderExtension"
  ADD COLUMN "deliveryFee" DECIMAL(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "deliveryFeeLabel" TEXT;
