-- Idempotent rename
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'RentalWebhookOutbox') THEN
    ALTER TABLE "RentalWebhookOutbox" RENAME TO "WebhookOutbox";
  END IF;
END $$;

-- Idempotent Add Columns
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'WebhookOutbox') THEN
    ALTER TABLE "WebhookOutbox" ADD COLUMN IF NOT EXISTS "integrationId" TEXT;
    ALTER TABLE "WebhookOutbox" ADD COLUMN IF NOT EXISTS "event" TEXT;
    
    -- Migrate existing deliveryType if column exists
    IF EXISTS (SELECT column_name FROM information_schema.columns WHERE table_name='webhookoutbox' AND column_name='deliveryType') THEN
      UPDATE "WebhookOutbox" SET "event" = "deliveryType"::text;
      ALTER TABLE "WebhookOutbox" DROP COLUMN "deliveryType";
    END IF;
  END IF;
END $$;

ALTER TABLE IF EXISTS "RentalOrder" ADD COLUMN IF NOT EXISTS "integrationId" TEXT;
ALTER TABLE IF EXISTS "RentalBundle" ADD COLUMN IF NOT EXISTS "integrationId" TEXT;

-- Idempotent Fkey constraints
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'WebhookOutbox') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WebhookOutbox_integrationId_fkey') THEN
      ALTER TABLE "WebhookOutbox" ADD CONSTRAINT "WebhookOutbox_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'RentalOrder') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RentalOrder_integrationId_fkey') THEN
      ALTER TABLE "RentalOrder" ADD CONSTRAINT "RentalOrder_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'RentalBundle') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RentalBundle_integrationId_fkey') THEN
      ALTER TABLE "RentalBundle" ADD CONSTRAINT "RentalBundle_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;
