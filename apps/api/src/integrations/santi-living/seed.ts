/* eslint-disable @typescript-eslint/no-explicit-any */

export async function seedSantiLiving(
  prisma: any,
  companyId: string,
  isDevelopment: boolean = false
) {
  const appId = 'santi-living';
  const integration = await prisma.integration.upsert({
    where: {
      companyId_appId: { companyId, appId },
    },
    update: {},
    create: {
      companyId,
      appId,
      name: 'Santi Living',
      description: 'Official Santi Living Integration',
      icon: 'CubeIcon',
      isActive: true,
      config: {
        webhookUrl: isDevelopment
          ? 'http://localhost:3002/api/webhooks/sync-erp'
          : 'https://proxy.santiliving.com/api/webhooks/order-confirmation',
        assetBaseUrl: 'https://storage.googleapis.com/santi-living-public',
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
        companyId,
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
          companyId,
          name: 'Santi Living Production',
        },
      });
      if (!existing) {
        const existingApiKey = await prisma.apiKey.findFirst({
          where: {
            companyId,
            keyPrefix: keyPrefix,
          },
        });

        if (!existingApiKey) {
          await prisma.apiKey.create({
            data: {
              companyId,
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
          console.log(`✅ API Key created for ${companyId}`);
        } else {
          console.log(
            `ℹ️ API Key already exists for ${companyId}, skipping creation.`
          );
        }
      }
    });
}
