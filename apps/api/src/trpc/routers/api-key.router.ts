import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '@sync-erp/database';
import { TRPCError } from '@trpc/server';
import { apiKeyService } from '../../services/api-key.service';
import { webhookService } from '../../services/webhook.service';

/**
 * API Key Management Router
 * Admin endpoints for managing multi-tenant API keys
 */
export const apiKeyRouter = router({
  /**
   * List all API keys for the current company
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return apiKeyService.listKeys(ctx.companyId);
  }),

  /**
   * Generate a new API key for the current company
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(100),
        webhookUrl: z.string().url().optional(),
        permissions: z.array(z.string()).optional(),
        rateLimit: z.number().min(100).max(10000).optional(),
        expiresInDays: z.number().min(1).max(365).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const expiresAt = input.expiresInDays
        ? new Date(
            Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000
          )
        : undefined;

      const result = await apiKeyService.createKey(
        ctx.companyId,
        input.name,
        {
          webhookUrl: input.webhookUrl,
          permissions: input.permissions,
          rateLimit: input.rateLimit,
          expiresAt,
        }
      );

      // Return the key only once - it cannot be retrieved later
      return {
        id: result.id,
        key: result.key, // IMPORTANT: Only shown once!
        keyPrefix: result.keyPrefix,
        name: input.name,
        message:
          'API key created. Copy the key now - it will not be shown again.',
      };
    }),

  /**
   * Revoke an API key
   */
  revoke: protectedProcedure
    .input(z.object({ keyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const key = await prisma.apiKey.findFirst({
        where: { id: input.keyId, companyId: ctx.companyId },
      });

      if (!key) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'API key not found',
        });
      }

      await apiKeyService.revokeKey(input.keyId);
      return { success: true, message: 'API key revoked' };
    }),

  /**
   * Update webhook configuration for an API key
   */
  updateWebhook: protectedProcedure
    .input(
      z.object({
        keyId: z.string(),
        webhookUrl: z.string().url().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const key = await prisma.apiKey.findFirst({
        where: { id: input.keyId, companyId: ctx.companyId },
      });

      if (!key) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'API key not found',
        });
      }

      await apiKeyService.updateWebhook(
        input.keyId,
        input.webhookUrl
      );
      return { success: true };
    }),

  /**
   * Update API key details (name, rate limit)
   */
  update: protectedProcedure
    .input(
      z.object({
        keyId: z.string(),
        name: z.string().min(2).max(100).optional(),
        rateLimit: z.number().min(100).max(10000).optional(),
        webhookUrl: z.string().url().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const key = await prisma.apiKey.findFirst({
        where: { id: input.keyId, companyId: ctx.companyId },
      });

      if (!key) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'API key not found',
        });
      }

      await apiKeyService.updateKey(input.keyId, {
        name: input.name,
        rateLimit: input.rateLimit,
      });

      if (input.webhookUrl !== undefined) {
        await apiKeyService.updateWebhook(
          input.keyId,
          input.webhookUrl
        );
      }

      return { success: true, message: 'API key updated' };
    }),

  /**
   * Test webhook connectivity
   */
  testWebhook: protectedProcedure
    .input(
      z.object({
        webhookUrl: z.string().url(),
        webhookSecret: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await webhookService.testWebhook(
        input.webhookUrl,
        input.webhookSecret
      );

      if (!result.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Webhook test failed: ${result.error}`,
        });
      }

      return {
        success: true,
        statusCode: result.statusCode,
        latencyMs: result.duration,
      };
    }),

  /**
   * Get API usage stats for dashboard
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const [keys, recentOrders] = await Promise.all([
      prisma.apiKey.findMany({
        where: { companyId: ctx.companyId },
        select: {
          id: true,
          name: true,
          lastUsedAt: true,
          isActive: true,
        },
      }),
      prisma.rentalOrder.count({
        where: {
          companyId: ctx.companyId,
          orderSource: 'WEBSITE',
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    return {
      totalKeys: keys.length,
      activeKeys: keys.filter((k) => k.isActive).length,
      ordersLast30Days: recentOrders,
      keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        lastUsedAt: k.lastUsedAt,
        isActive: k.isActive,
      })),
    };
  }),
});
