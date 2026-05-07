const fs = require('fs');
let content = fs.readFileSync('apps/api/test/integration/rental/webhook-outbox.service.test.ts', 'utf8');

const targetStr = `const seedIntegration = async (overrides?: {
  webhookUrl?: string;
  webhookSecret?: string;
  paths?: Record<string, string>;
  isActive?: boolean;
}) => {
  await cleanupIntegrationData();

  const integration = await prisma.integration.create({
    data: {
      companyId: COMPANY_ID,
      appId: 'santi-living',
      name: 'Santi Living',
      isActive: overrides?.isActive ?? true,
      config: {
        webhookUrl: overrides?.webhookUrl ?? 'http://proxy.test',
        paths: overrides?.paths ?? {
          newOrder: '/api/orders/{token}/notify-admin',
          paymentStatus: '/api/orders/{token}/notify-payment',
        },
      },
    },
  });`;

const replacement = `import { integrationRegistry } from '@src/integrations/registry';

const seedIntegration = async (overrides?: {
  webhookUrl?: string;
  webhookSecret?: string;
  paths?: Record<string, string>;
  isActive?: boolean;
}) => {
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

  await cleanupIntegrationData();

  const integration = await prisma.integration.create({
    data: {
      companyId: COMPANY_ID,
      appId: 'test-plugin',
      name: 'Test Plugin',
      isActive: overrides?.isActive ?? true,
      config: {
        webhookUrl: overrides?.webhookUrl ?? 'http://proxy.test',
      },
    },
  });`;

content = content.replace(targetStr, replacement);
fs.writeFileSync('apps/api/test/integration/rental/webhook-outbox.service.test.ts', content);
