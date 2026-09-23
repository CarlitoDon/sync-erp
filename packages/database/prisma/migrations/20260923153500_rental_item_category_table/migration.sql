-- Drop old enum column & type
ALTER TABLE "RentalItem" DROP COLUMN IF EXISTS "category";
DROP TYPE IF EXISTS "RentalItemCategory";

-- Create RentalItemCategory table
CREATE TABLE "RentalItemCategory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentalItemCategory_pkey" PRIMARY KEY ("id")
);

-- Unique constraint & index
CREATE UNIQUE INDEX "RentalItemCategory_companyId_name_key" ON "RentalItemCategory"("companyId", "name");
CREATE INDEX "RentalItemCategory_companyId_idx" ON "RentalItemCategory"("companyId");

-- Foreign key to Company
ALTER TABLE "RentalItemCategory" ADD CONSTRAINT "RentalItemCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add categoryId to RentalItem
ALTER TABLE "RentalItem" ADD COLUMN "categoryId" TEXT;
CREATE INDEX "RentalItem_categoryId_idx" ON "RentalItem"("categoryId");
ALTER TABLE "RentalItem" ADD CONSTRAINT "RentalItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "RentalItemCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default categories for existing companies
INSERT INTO "RentalItemCategory" ("id", "companyId", "name", "description", "updatedAt")
SELECT gen_random_uuid()::text, c.id, 'Kasur', 'Kasur busa berbagai ukuran', CURRENT_TIMESTAMP
FROM "Company" c
ON CONFLICT ("companyId", "name") DO NOTHING;

INSERT INTO "RentalItemCategory" ("id", "companyId", "name", "description", "updatedAt")
SELECT gen_random_uuid()::text, c.id, 'Karpet', 'Karpet permadani dan alas lantai', CURRENT_TIMESTAMP
FROM "Company" c
ON CONFLICT ("companyId", "name") DO NOTHING;

INSERT INTO "RentalItemCategory" ("id", "companyId", "name", "description", "updatedAt")
SELECT gen_random_uuid()::text, c.id, 'Elektronik & Pendingin', 'Kipas angin, air cooler, TV display', CURRENT_TIMESTAMP
FROM "Company" c
ON CONFLICT ("companyId", "name") DO NOTHING;

INSERT INTO "RentalItemCategory" ("id", "companyId", "name", "description", "updatedAt")
SELECT gen_random_uuid()::text, c.id, 'Item Extras & Aksesoris', 'Bantal, guling, sprei, selimut, bed cover', CURRENT_TIMESTAMP
FROM "Company" c
ON CONFLICT ("companyId", "name") DO NOTHING;

-- Link existing rental items to their category
UPDATE "RentalItem" r
SET "categoryId" = cat.id
FROM "Product" p, "RentalItemCategory" cat
WHERE r."productId" = p.id
  AND cat."companyId" = r."companyId"
  AND cat.name = 'Kasur'
  AND p."sku" LIKE 'KASUR-%';

UPDATE "RentalItem" r
SET "categoryId" = cat.id
FROM "Product" p, "RentalItemCategory" cat
WHERE r."productId" = p.id
  AND cat."companyId" = r."companyId"
  AND cat.name = 'Karpet'
  AND p."sku" LIKE 'KARPET-%';

UPDATE "RentalItem" r
SET "categoryId" = cat.id
FROM "Product" p, "RentalItemCategory" cat
WHERE r."productId" = p.id
  AND cat."companyId" = r."companyId"
  AND cat.name = 'Elektronik & Pendingin'
  AND (p."sku" LIKE 'KIPAS-%' OR p."sku" LIKE 'AIR-%' OR p."sku" LIKE 'TV-%');

UPDATE "RentalItem" r
SET "categoryId" = cat.id
FROM "Product" p, "RentalItemCategory" cat
WHERE r."productId" = p.id
  AND cat."companyId" = r."companyId"
  AND cat.name = 'Item Extras & Aksesoris'
  AND (p."sku" LIKE 'BANTAL-%' OR p."sku" LIKE 'GULING-%' OR p."sku" LIKE 'SPREI-%' OR p."sku" LIKE 'SELIMUT-%' OR p."sku" LIKE 'BED-%');
