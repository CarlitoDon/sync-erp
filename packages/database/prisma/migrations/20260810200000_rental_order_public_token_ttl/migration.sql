-- Add strict TTL/expiry enforcement for rental public order tokens.
-- Public order tokens must be time-boxed so that a leaked token cannot be
-- used to track an order indefinitely.
ALTER TABLE "RentalOrder" ADD COLUMN IF NOT EXISTS "publicTokenExpiresAt" TIMESTAMP(3);

-- Backfill: pre-existing orders without an expiry get a 30-day expiry from
-- their last update. This keeps every order under the new enforcement
-- immediately, including legacy records created before the column existed.
UPDATE "RentalOrder"
SET "publicTokenExpiresAt" = "updatedAt" + INTERVAL '30 days'
WHERE "publicTokenExpiresAt" IS NULL
  AND "publicToken" IS NOT NULL;

-- Index for the expiry lookup path used when an order transitions from DRAFT
-- (public tracking window ends at confirmation/activation).
CREATE INDEX IF NOT EXISTS "RentalOrder_publicTokenExpiresAt_idx"
  ON "RentalOrder" ("publicTokenExpiresAt");
