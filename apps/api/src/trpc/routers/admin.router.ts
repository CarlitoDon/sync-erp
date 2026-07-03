import { router, protectedProcedure } from '../trpc';
import { container, ServiceKeys } from '../../modules/common/di';
import { z } from 'zod';
import {
<<<<<<< HEAD
  RentalWebhookDeliveryType,
=======
>>>>>>> origin/dev
  RentalWebhookOutboxStatus,
  TenantWebhookOutboxStatus,
} from '@sync-erp/database';
import { AdminService } from '../../modules/admin/service';
<<<<<<< HEAD
import { rentalWebhookOutboxService } from '../../modules/rental/rental-webhook-outbox.service';
=======
import { webhookOutboxService } from '../../modules/rental/webhook-outbox.service';
>>>>>>> origin/dev
import { tenantWebhookOutboxService } from '../../services/tenant-webhook-outbox.service';

const adminService = container.resolve<AdminService>(
  ServiceKeys.ADMIN_SERVICE
);

export const adminRouter = router({
  /**
   * Get saga logs (failed, compensated, compensation failed)
   */
  getSagaLogs: protectedProcedure
    .input(
      z.object({
        step: z.string().optional(),
        limit: z.number().default(20),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      return adminService.getSagaLogs({
        companyId: ctx.companyId!,
        step: input.step,
        limit: input.limit,
        offset: input.offset,
      });
    }),

  /**
   * Get orphan journal entries
   */
  getOrphanJournals: protectedProcedure
    .input(
      z.object({
        limit: z.number().default(20),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      return adminService.getOrphanJournals({
        companyId: ctx.companyId!,
        limit: input.limit,
        offset: input.offset,
      });
    }),

  /**
   * Get rental webhook outbox counts for operator dashboard
   */
  getRentalWebhookOutboxStats: protectedProcedure
    .query(async ({ ctx }) => {
      const [counts, health] = await Promise.all([
<<<<<<< HEAD
        rentalWebhookOutboxService.getQueueCounts(
          ctx.companyId!
        ),
        rentalWebhookOutboxService.getHealthSignal(
=======
        webhookOutboxService.getQueueCounts(
          ctx.companyId!
        ),
        webhookOutboxService.getHealthSignal(
>>>>>>> origin/dev
          ctx.companyId!
        ),
      ]);

      return {
        counts,
        health,
      };
    }),

  /**
   * List replay candidates and outbox history
   */
  listRentalWebhookOutbox: protectedProcedure
    .input(
      z.object({
        statuses: z
          .array(z.nativeEnum(RentalWebhookOutboxStatus))
          .optional(),
<<<<<<< HEAD
        deliveryType: z
          .nativeEnum(RentalWebhookDeliveryType)
          .optional(),
=======
        event: z.string().optional(),
>>>>>>> origin/dev
        limit: z.number().int().min(1).max(200).default(20),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
<<<<<<< HEAD
      return rentalWebhookOutboxService.listDeliveries({
=======
      return webhookOutboxService.listDeliveries({
>>>>>>> origin/dev
        companyId: ctx.companyId!,
        statuses:
          input.statuses && input.statuses.length > 0
            ? input.statuses
            : [
                RentalWebhookOutboxStatus.FAILED,
                RentalWebhookOutboxStatus.DEAD_LETTER,
              ],
<<<<<<< HEAD
        deliveryType: input.deliveryType,
=======
        event: input.event,
>>>>>>> origin/dev
        limit: input.limit,
        offset: input.offset,
      });
    }),

  /**
   * Get full payload/error details for one outbox delivery
   */
  getRentalWebhookOutboxDetail: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
<<<<<<< HEAD
      return rentalWebhookOutboxService.getDeliveryDetail({
=======
      return webhookOutboxService.getDeliveryDetail({
>>>>>>> origin/dev
        companyId: ctx.companyId!,
        id: input.id,
      });
    }),

  /**
   * Replay one failed/dead-letter outbox item manually
   */
  replayRentalWebhookOutbox: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const requeued =
<<<<<<< HEAD
        await rentalWebhookOutboxService.requeueDelivery(input.id, {
=======
        await webhookOutboxService.requeueDelivery(input.id, {
>>>>>>> origin/dev
          companyId: ctx.companyId!,
        });

      return { success: requeued };
    }),

  /**
   * Bulk replay failed/dead-letter items
   */
  replayRentalWebhookOutboxBulk: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.string()).optional(),
        statuses: z
          .array(z.nativeEnum(RentalWebhookOutboxStatus))
          .optional(),
        limit: z.number().int().min(1).max(500).default(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const requeuedCount =
<<<<<<< HEAD
        await rentalWebhookOutboxService.requeueDeliveries({
=======
        await webhookOutboxService.requeueDeliveries({
>>>>>>> origin/dev
          companyId: ctx.companyId!,
          ids: input.ids,
          statuses: input.statuses,
          limit: input.limit,
        });

      return {
        success: true,
        requeuedCount,
      };
    }),

  /**
   * Get tenant webhook outbox counts for operator dashboard
   */
  getTenantWebhookOutboxStats: protectedProcedure
    .query(async ({ ctx }) => {
      const [counts, health] = await Promise.all([
        tenantWebhookOutboxService.getQueueCounts(
          ctx.companyId!
        ),
        tenantWebhookOutboxService.getHealthSignal(
          ctx.companyId!
        ),
      ]);

      return {
        counts,
        health,
      };
    }),

  /**
   * List tenant webhook outbox history
   */
  listTenantWebhookOutbox: protectedProcedure
    .input(
      z.object({
        statuses: z
          .array(z.nativeEnum(TenantWebhookOutboxStatus))
          .optional(),
        event: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(20),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      return tenantWebhookOutboxService.listDeliveries({
        companyId: ctx.companyId!,
        statuses:
          input.statuses && input.statuses.length > 0
            ? input.statuses
            : [
                TenantWebhookOutboxStatus.FAILED,
                TenantWebhookOutboxStatus.DEAD_LETTER,
              ],
        event: input.event,
        limit: input.limit,
        offset: input.offset,
      });
    }),

  /**
   * Get one tenant webhook outbox record detail
   */
  getTenantWebhookOutboxDetail: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return tenantWebhookOutboxService.getDeliveryDetail({
        companyId: ctx.companyId!,
        id: input.id,
      });
    }),

  /**
   * Replay one tenant webhook outbox item manually
   */
  replayTenantWebhookOutbox: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const requeued =
        await tenantWebhookOutboxService.requeueDelivery(input.id, {
          companyId: ctx.companyId!,
        });

      return { success: requeued };
    }),

  /**
   * Bulk replay tenant webhook outbox items
   */
  replayTenantWebhookOutboxBulk: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.string()).optional(),
        statuses: z
          .array(z.nativeEnum(TenantWebhookOutboxStatus))
          .optional(),
        limit: z.number().int().min(1).max(500).default(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const requeuedCount =
        await tenantWebhookOutboxService.requeueDeliveries({
          companyId: ctx.companyId!,
          ids: input.ids,
          statuses: input.statuses,
          limit: input.limit,
        });

      return {
        success: true,
        requeuedCount,
      };
    }),
});

export type AdminRouter = typeof adminRouter;
