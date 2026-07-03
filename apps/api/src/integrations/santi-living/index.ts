/* eslint-disable @typescript-eslint/no-explicit-any */
import { IntegrationPlugin } from '../types.js';
import { santiLivingManifest } from './manifest.js';
import { buildWebhookPayload, getWebhookPath } from './webhooks/payload-builder.js';
import { santiLivingOrderAdapter } from './order-handler.js';

export const santiLivingPlugin: IntegrationPlugin = {
  manifest: santiLivingManifest,
  buildWebhookPayload,
  getWebhookPath(event: string, orderPublicToken: string, config: Record<string, unknown>) {
    return getWebhookPath(event, orderPublicToken, (config.paths as Record<string, unknown>) ?? null);
  },
  getOrderAdapter: () => santiLivingOrderAdapter,
  registerRoutes: (_routerBuilder: any) => {
    // You could inject additional routes for syncing bundles here if needed
    // Example:
    /*
    const router = routerBuilder({
      syncBundles: publicProcedure
        .input(z.object({ bundles: z.array(z.any()) }))
        .mutation(({ input, ctx }) => syncFromSantiLiving({ companyId: ctx.companyId, bundles: input.bundles }))
    });
    return router;
    */
  },
};
