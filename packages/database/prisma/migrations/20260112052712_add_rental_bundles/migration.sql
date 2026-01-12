-- DropForeignKey
ALTER TABLE "RentalOrderItem" DROP CONSTRAINT "RentalOrderItem_rentalItemId_fkey";

-- AlterTable
ALTER TABLE "RentalOrderItem" ADD COLUMN     "rentalBundleId" TEXT,
ALTER COLUMN "rentalItemId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "RentalBundle" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "description" TEXT,
    "dailyRate" DECIMAL(15,2) NOT NULL,
    "weeklyRate" DECIMAL(15,2),
    "monthlyRate" DECIMAL(15,2),
    "dimensions" TEXT,
    "capacity" TEXT,
    "imagePath" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalBundleComponent" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "rentalItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "componentLabel" TEXT NOT NULL,

    CONSTRAINT "RentalBundleComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RentalBundle_companyId_idx" ON "RentalBundle"("companyId");

-- CreateIndex
CREATE INDEX "RentalBundle_companyId_isActive_idx" ON "RentalBundle"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RentalBundle_companyId_externalId_key" ON "RentalBundle"("companyId", "externalId");

-- CreateIndex
CREATE INDEX "RentalBundleComponent_bundleId_idx" ON "RentalBundleComponent"("bundleId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalBundleComponent_bundleId_rentalItemId_key" ON "RentalBundleComponent"("bundleId", "rentalItemId");

-- CreateIndex
CREATE INDEX "RentalOrderItem_rentalItemId_idx" ON "RentalOrderItem"("rentalItemId");

-- CreateIndex
CREATE INDEX "RentalOrderItem_rentalBundleId_idx" ON "RentalOrderItem"("rentalBundleId");

-- AddForeignKey
ALTER TABLE "RentalBundle" ADD CONSTRAINT "RentalBundle_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalBundleComponent" ADD CONSTRAINT "RentalBundleComponent_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "RentalBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalBundleComponent" ADD CONSTRAINT "RentalBundleComponent_rentalItemId_fkey" FOREIGN KEY ("rentalItemId") REFERENCES "RentalItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalOrderItem" ADD CONSTRAINT "RentalOrderItem_rentalItemId_fkey" FOREIGN KEY ("rentalItemId") REFERENCES "RentalItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalOrderItem" ADD CONSTRAINT "RentalOrderItem_rentalBundleId_fkey" FOREIGN KEY ("rentalBundleId") REFERENCES "RentalBundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
