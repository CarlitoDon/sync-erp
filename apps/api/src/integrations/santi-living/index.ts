import { IntegrationPlugin } from '../types.js';
import { santiLivingManifest } from './manifest.js';
import { buildWebhookPayload, getWebhookPath } from './webhooks/payload-builder.js';
import { santiLivingOrderAdapter } from './order-handler.js';

export const santiLivingPlugin: IntegrationPlugin = {
  manifest: santiLivingManifest,
  buildWebhookPayload,
  getWebhookPath(event: string, orderPublicToken: string, config: Record<string, unknown>): string {
    return getWebhookPath(event, orderPublicToken, config.paths);
  },
  getOrderAdapter: () => santiLivingOrderAdapter,
  registerRoutes: (_routerBuilder: unknown): void => {
    // You could inject additional routes for syncing bundles here if needed
    // Example:
    /*
    const router = routerBuilder({
      syncBundles: publicProcedure
        .input(SyncFromSantiLivingInputSchema.pick({ bundles: true }))
        .mutation(({ input, ctx }) => syncFromSantiLiving({ companyId: ctx.companyId, bundles: input.bundles }))
    });
    return router;
    */
  },
};
