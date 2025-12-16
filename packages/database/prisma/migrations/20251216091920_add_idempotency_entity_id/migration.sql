/*
  Warnings:

  - A unique constraint covering the columns `[companyId,scope,entityId]` on the table `IdempotencyKey` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "IdempotencyKey" ADD COLUMN     "entityId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_companyId_scope_entityId_key" ON "IdempotencyKey"("companyId", "scope", "entityId");
