import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { integrationService } from '../../services/integration.service';
import { apiKeyService } from '../../services/api-key.service';
// import { TRPCError } from '@trpc/server';

export const integrationRouter = router({
  /**
   * List available and installed integrations
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return integrationService.listIntegrations(ctx.companyId);
  }),

  /**
   * Install an integration
   */
  install: protectedProcedure
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
      const keyResult = await apiKeyService.createKey(
        ctx.companyId,
        keyName,
        {
          permissions: ['rental:read', 'rental:write'], // Default perms
          rateLimit: 1000,
        }
      );

      // Link key to integration
      // Note: We need to update apiKeyService to support integrationId or do it manually here
      // Since we just added the column, let's update it manually
      const { prisma } = await import('@sync-erp/database');
      await prisma.apiKey.update({
        where: { id: keyResult.id },
        data: { integrationId: integration.id },
      });

      return {
        integration,
        apiKey: keyResult, // Return the secret key once!
      };
    }),

  /**
   * Create a custom integration
   */
  createCustom: protectedProcedure
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
          permissions: ['rental:read', 'rental:write'],
          rateLimit: 1000,
        }
      );

      const { prisma } = await import('@sync-erp/database');
      await prisma.apiKey.update({
        where: { id: keyResult.id },
        data: { integrationId: integration.id },
      });

      return {
        integration,
        apiKey: keyResult,
      };
    }),

  /**
   * Get single integration details
   */
  get: protectedProcedure
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
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        isActive: z.boolean().optional(),
        config: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return integrationService.updateConfig(
        ctx.companyId,
        input.id,
        input.config,
        input.isActive
      );
    }),

  /**
   * Generate a new key for an integration
   */
  rotateKey: protectedProcedure
    .input(z.object({ integrationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const integration = await integrationService.getIntegration(
        ctx.companyId,
        input.integrationId
      );

      const keyName = `${integration.name} Key - ${new Date().toLocaleDateString()}`;
      const keyResult = await apiKeyService.createKey(
        ctx.companyId,
        keyName,
        {
          permissions: ['rental:read', 'rental:write'],
        }
      );

      const { prisma } = await import('@sync-erp/database');
      await prisma.apiKey.update({
        where: { id: keyResult.id },
        data: { integrationId: integration.id },
      });

      return keyResult;
    }),
});
