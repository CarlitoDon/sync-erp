-- DropIndex
DROP INDEX "IdempotencyKey_companyId_scope_entityId_key";

-- CreateIndex
CREATE INDEX "IdempotencyKey_companyId_scope_entityId_idx" ON "IdempotencyKey"("companyId", "scope", "entityId");
