import {
  getSafeApiKeyPermissions,
  integrationManagementProcedure,
  router,
} from '../trpc';
import { z } from 'zod';
import { integrationService } from '../../services/integration.service';
import { apiKeyService } from '../../services/api-key.service';
import { DEFAULT_RATE_LIMIT } from '@sync-erp/shared';
import { prisma } from '@sync-erp/database';

export const integrationRouter = router({
  /**
   * List available and installed integrations
   */
  list: integrationManagementProcedure.query(async ({ ctx }) => {
    return integrationService.listIntegrations(ctx.companyId);
  }),

  /**
   * Install an integration
   */
  install: integrationManagementProcedure
    .input(z.object({ appId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const integration = await integrationService.install(
        ctx.companyId,
        input.appId
      );

      // Create a default API Key for this integration if none exists
      // Check if we already have keys
      // Filter for this integration specifically if we add integrationId column to filtering
      // For now, let's just create a new one specific to this app

      const keyName = `${integration.name} Key`;
      const previousKey = await prisma.apiKey.findFirst({
        where: {
          companyId: ctx.companyId,
          integrationId: integration.id,
          isActive: true,
        },
        select: { permissions: true },
      });
      const permissions = getSafeApiKeyPermissions(
        ctx,
        previousKey?.permissions
      );
      const keyResult = previousKey
        ? await apiKeyService.rotateKey(
            ctx.companyId,
            integration.id,
            keyName,
            { permissions }
          )
        : await apiKeyService.createKey(ctx.companyId, keyName, {
            permissions,
            rateLimit: DEFAULT_RATE_LIMIT,
            integrationId: integration.id,
          });

      return {
        integration,
        apiKey: keyResult, // Return the secret key once!
      };
    }),

  /**
   * Create a custom integration
   */
  createCustom: integrationManagementProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const integration = await integrationService.createCustom(
        ctx.companyId,
        input
      );

      // Auto-generate a key for custom integrations immediately
      const keyName = `${integration.name} Key`;
      const keyResult = await apiKeyService.createKey(
        ctx.companyId,
        keyName,
        {
          permissions: getSafeApiKeyPermissions(ctx),
          rateLimit: DEFAULT_RATE_LIMIT,
          integrationId: integration.id,
        }
      );

      return {
        integration,
        apiKey: keyResult,
      };
    }),

  /**
   * Get single integration details
   */
  get: integrationManagementProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return integrationService.getIntegration(
        ctx.companyId,
        input.id
      );
    }),

  /**
   * Update integration config/status
   */
  update: integrationManagementProcedure
    .input(
      z.object({
        id: z.string(),
        isActive: z.boolean().optional(),
        config: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return integrationService.updateConfig(
        ctx.companyId,
        input.id,
        (input.config || {}) as Record<string, unknown>,
        input.isActive
      );
    }),

  /**
   * Generate a new key for an integration
   */
  rotateKey: integrationManagementProcedure
    .input(z.object({ integrationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const integration = await integrationService.getIntegration(
        ctx.companyId,
        input.integrationId
      );

      const keyName = `${integration.name} Key - ${new Date().toLocaleDateString()}`;
      const permissions = getSafeApiKeyPermissions(
        ctx,
        integration.apiKeys.find((key) => key.isActive)?.permissions
      );
      const keyResult = await apiKeyService.rotateKey(
        ctx.companyId,
        integration.id,
        keyName,
        {
          permissions,
        }
      );

      return keyResult;
    }),
});
