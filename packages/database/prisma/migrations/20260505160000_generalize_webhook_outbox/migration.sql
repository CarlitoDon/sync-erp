ALTER TABLE "RentalWebhookOutbox" RENAME TO "WebhookOutbox";
ALTER TABLE "WebhookOutbox" ADD COLUMN "integrationId" TEXT, ADD COLUMN "event" TEXT;
UPDATE "WebhookOutbox" SET "event" = "deliveryType"::text;
ALTER TABLE "WebhookOutbox" DROP COLUMN "deliveryType";

ALTER TABLE "RentalOrder" ADD COLUMN "integrationId" TEXT;
ALTER TABLE "RentalBundle" ADD COLUMN "integrationId" TEXT;

ALTER TABLE "WebhookOutbox" ADD CONSTRAINT "WebhookOutbox_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RentalOrder" ADD CONSTRAINT "RentalOrder_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RentalBundle" ADD CONSTRAINT "RentalBundle_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
