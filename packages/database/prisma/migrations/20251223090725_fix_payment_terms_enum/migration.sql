/*
  Warnings:

  - The values [PARTIAL] on the enum `PaymentTerms` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PaymentTerms_new" AS ENUM ('NET7', 'NET30', 'NET60', 'NET90', 'COD', 'EOM', 'NET_30', 'UPFRONT');
ALTER TABLE "public"."Order" ALTER COLUMN "paymentTerms" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "paymentTerms" TYPE "PaymentTerms_new" USING ("paymentTerms"::text::"PaymentTerms_new");
ALTER TYPE "PaymentTerms" RENAME TO "PaymentTerms_old";
ALTER TYPE "PaymentTerms_new" RENAME TO "PaymentTerms";
DROP TYPE "public"."PaymentTerms_old";
ALTER TABLE "Order" ALTER COLUMN "paymentTerms" SET DEFAULT 'NET_30';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SequenceType" ADD VALUE 'SO';
ALTER TYPE "SequenceType" ADD VALUE 'INV';
ALTER TYPE "SequenceType" ADD VALUE 'CN';
ALTER TYPE "SequenceType" ADD VALUE 'JE';
