const fs = require('fs');

let content = fs.readFileSync('apps/api/test/integration/rental/rental-webhook-outbox.admin-router.test.ts', 'utf8');

const targetStr = `const seedIntegration = async (companyId: string) => {
  const existing = await prisma.integration.findFirst({
    where: { companyId, appId: 'santi-living' },
  });

  if (existing) {
    await prisma.apiKey.deleteMany({
      where: { integrationId: existing.id },
    });
    await prisma.integration.delete({ where: { id: existing.id } });
  }

  const integration = await prisma.integration.create({
    data: {
      companyId,
      appId: 'santi-living',
      name: 'Santi Living',
      isActive: true,
      config: {
        webhookUrl: 'http://proxy.test',
        paths: {
          newOrder: '/api/orders/{token}/notify-admin',
          paymentStatus: '/api/orders/{token}/notify-payment',
        },
      },
    },
  });`;

const replacement = `import { integrationRegistry } from '@src/integrations/registry';

const seedIntegration = async (companyId: string) => {
  if (!integrationRegistry.get('test-plugin')) {
    integrationRegistry.register({
      manifest: {
        appId: 'test-plugin',
        name: 'Test Plugin',
        description: 'Test Plugin',
        icon: 'Test',
        capabilities: [],
        defaultConfig: {},
      },
      getWebhookPath: (event, token, config) => {
        return event === 'order.created' ? \`/api/orders/\${token}/notify-admin\` : \`/api/orders/\${token}/notify-payment\`;
      }
    });
  }

  const existing = await prisma.integration.findFirst({
    where: { companyId, appId: 'test-plugin' },
  });

  if (existing) {
    await prisma.apiKey.deleteMany({
      where: { integrationId: existing.id },
    });
    await prisma.integration.delete({ where: { id: existing.id } });
  }

  const integration = await prisma.integration.create({
    data: {
      companyId,
      appId: 'test-plugin',
      name: 'Test Plugin',
      isActive: true,
      config: {
        webhookUrl: 'http://proxy.test',
      },
    },
  });`;

content = content.replace(targetStr, replacement);
fs.writeFileSync('apps/api/test/integration/rental/rental-webhook-outbox.admin-router.test.ts', content);
