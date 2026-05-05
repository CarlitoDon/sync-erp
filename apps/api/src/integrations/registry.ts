import { IntegrationPlugin } from './types.js';
import { santiLivingPlugin } from './santi-living/index.js';

class IntegrationRegistry {
  private plugins = new Map<string, IntegrationPlugin>();

  register(plugin: IntegrationPlugin) {
    if (this.plugins.has(plugin.manifest.appId)) {
      throw new Error(`Integration ${plugin.manifest.appId} is already registered.`);
    }
    this.plugins.set(plugin.manifest.appId, plugin);
  }

  get(appId: string): IntegrationPlugin | undefined {
    return this.plugins.get(appId);
  }

  list(): IntegrationPlugin[] {
    return Array.from(this.plugins.values());
  }
}

export const integrationRegistry = new IntegrationRegistry();

export function registerIntegrations() {
  integrationRegistry.register(santiLivingPlugin);
}
