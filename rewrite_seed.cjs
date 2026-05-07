const fs = require('fs');
let content = fs.readFileSync('packages/database/prisma/seed.ts', 'utf8');

const targetStr = `      // Create API Key for rental company (multi-tenant integration)
      if (companyDef.businessShape === 'RENTAL') {
        const isDevelopment = process.env.NODE_ENV === 'development';

        // 1. Ensure Integration Record exists
        const appId = 'santi-living';
        const integration = await prisma.integration.upsert({
          where: {
            companyId_appId: { companyId: company.id, appId },
          },
          update: {},
          create: {
            companyId: company.id,
            appId,
            name: 'Santi Living',
            description: 'Official Santi Living Integration',
            icon: 'CubeIcon',
            isActive: true,
            config: {
              webhookUrl: isDevelopment
                ? 'http://localhost:3002/api/webhooks/sync-erp'
                : 'https://proxy.santiliving.com/api/webhooks/order-confirmation',
            },
          },
        });

        // Use development key for local dev, or fallback/production key for other envs (though this block is skipped in prod)
        const existingKey = isDevelopment
          ? 'dev_sync_erp_secret_key_2026'
          : 'santi_secret_auth_token_2026';

        const bcrypt = await import('bcryptjs');
        const keyHash = await bcrypt.hash(existingKey, 10);
        const keyPrefix = existingKey.substring(0, 11);

        await prisma.apiKey
          .upsert({
            where: { keyHash }, // Will fail uniqueness, use findFirst + create pattern
            update: {
              isActive: true,
              name: isDevelopment
                ? 'Santi Living Development'
                : 'Santi Living Production',
              integrationId: integration.id, // Link to integration
              webhookUrl: isDevelopment
                ? 'http://localhost:3002/api/webhooks/sync-erp'
                : 'https://proxy.santiliving.com/api/webhooks/order-confirmation',
            },
            create: {
              keyHash,
              keyPrefix,
              name: isDevelopment
                ? 'Santi Living Development'
                : 'Santi Living Production',
              companyId: company.id,
              integrationId: integration.id, // Link to integration
              permissions: ['rental:read', 'rental:write'],
              webhookUrl: isDevelopment
                ? 'http://localhost:3002/api/webhooks/sync-erp'
                : 'https://proxy.santiliving.com/api/webhooks/order-confirmation',
            },
          })
          .catch(async () => {
            // If upsert fails due to keyHash not being unique constraint, try findFirst
            const existing = await prisma.apiKey.findFirst({
              where: {
                companyId: company.id,
                name: 'Santi Living Production',
              },
            });
            if (!existing) {
              const existingApiKey = await prisma.apiKey.findFirst({
                where: {
                  companyId: company.id,
                  keyPrefix: keyPrefix,
                },
              });

              if (!existingApiKey) {
                await prisma.apiKey.create({
                  data: {
                    companyId: company.id,
                    integrationId: integration.id,
                    name: isDevelopment
                      ? 'Santi Living Development'
                      : 'Santi Living Production',
                    keyHash,
                    keyPrefix,
                    permissions: [
                      'publicRental.createOrder',
                      'publicRental.confirmPayment',
                    ],
                    webhookUrl: isDevelopment
                      ? 'http://localhost:3002/api/webhooks/sync-erp'
                      : 'https://proxy.santiliving.com/api/webhooks/sync-erp',
                    webhookSecret: 'whsec_test_123',
                    rateLimit: 1000,
                  },
                });
                console.log(\`✅ API Key created for \${company.name}\`);
              } else {
                console.log(
                  \`ℹ️ API Key already exists for \${company.name}, skipping creation.\`
                );
              }
            }
          });
        console.warn('🔑 API Key created for', companyDef.name);
      }`;

const replacement = `      // Create API Key for rental company (multi-tenant integration)
      if (companyDef.businessShape === 'RENTAL') {
        const isDevelopment = process.env.NODE_ENV === 'development';
        const { seedSantiLiving } = await import('../../apps/api/src/integrations/santi-living/seed.js');
        await seedSantiLiving(prisma, company.id, isDevelopment);
        console.warn('🔑 API Key and Integration created for', companyDef.name);
      }`;

content = content.replace(targetStr, replacement);
fs.writeFileSync('packages/database/prisma/seed.ts', content);
