#!/bin/bash
sed -i '' 's/model RentalWebhookOutbox/model WebhookOutbox/g' packages/database/prisma/schema.prisma
sed -i '' 's/deliveryType     RentalWebhookDeliveryType/event            String?/g' packages/database/prisma/schema.prisma
sed -i '' '/companyId        String/a\
  integrationId    String?\
  integration      Integration?              @relation(fields: [integrationId], references: [id])' packages/database/prisma/schema.prisma

sed -i '' '/companyId       String/a\
  integrationId   String?\
  integration     Integration?      @relation(fields: [integrationId], references: [id])' packages/database/prisma/schema.prisma

