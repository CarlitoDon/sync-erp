-- Create enum for rental item category (to replace string-based heuristics)
CREATE TYPE "RentalItemCategory" AS ENUM ('MATTRESS', 'ACCESSORY');

-- Add category column to RentalItem table
ALTER TABLE "RentalItem" 
ADD COLUMN "category" "RentalItemCategory" NOT NULL DEFAULT 'ACCESSORY';

-- Backfill existing items:
-- KASUR-* SKUs → MATTRESS
-- Others → ACCESSORY (already default)
UPDATE "RentalItem" r
SET "category" = 'MATTRESS'
FROM "Product" p
WHERE r."productId" = p.id AND p."sku" LIKE 'KASUR-%';
