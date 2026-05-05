import { IntegrationManifest } from '../types.js';

export const santiLivingManifest: IntegrationManifest = {
  appId: 'santi-living',
  name: 'Santi Living',
  description: 'Integration for Santi Living website, including rental bundle syncing and order webhooks.',
  icon: 'house',
  capabilities: ['rental:read', 'rental:write'],
  defaultConfig: {
    webhookUrl: 'https://webhook.santi.living/api/orders',
    assetBaseUrl: 'https://storage.googleapis.com/santi-living-public',
  },
};
