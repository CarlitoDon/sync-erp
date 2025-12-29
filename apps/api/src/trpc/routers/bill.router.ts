import { router, protectedProcedure } from '../trpc';
import { container, ServiceKeys } from '../../modules/common/di';
import { CreateBillFromPOSchema } from '@sync-erp/shared';
import { z } from 'zod';
import { BillService } from '../../modules/accounting/services/bill.service';

const billService = container.resolve<BillService>(
  ServiceKeys.BILL_SERVICE
);

export const billRouter = router({
  /**
   * List all bills for current company
   */
  list: protectedProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return billService.list(ctx.companyId, input?.status);
    }),

  /**
   * Get bill by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return billService.getById(input.id, ctx.companyId);
    }),

  /**
   * Create bill from Purchase Order
   */
  createFromPO: protectedProcedure
    .input(CreateBillFromPOSchema)
    .mutation(async ({ ctx, input }) => {
      return billService.createFromPurchaseOrder(
        ctx.companyId,
        input
      );
    }),

  /**
   * Post bill to ledger
   */
  post: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return billService.post(input.id, ctx.companyId);
    }),

  /**
   * Void bill (FR-024: requires reason)
   */
  void: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().min(1, 'Void reason is required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return billService.void(
        input.id,
        ctx.companyId,
        ctx.userId,
        input.reason,
        ctx.userPermissions // FR-026: Granular RBAC
      );
    }),

  /**
   * FR-051: Log acknowledged price variance
   */
  acknowledgePriceVariance: protectedProcedure
    .input(
      z.object({
        billId: z.string().uuid(),
        reason: z
          .string()
          .min(1, 'Acknowledgment reason is required'),
        varianceAmount: z.number(),
        variancePercent: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Import audit service dynamically to avoid circular deps
      const { recordAudit } =
        await import('../../modules/common/audit/audit-log.service');
      const { AuditLogAction, EntityType } =
        await import('@sync-erp/database');

      await recordAudit({
        companyId: ctx.companyId,
        actorId: ctx.userId,
        action: AuditLogAction.PRICE_VARIANCE_ACKNOWLEDGED,
        entityType: EntityType.BILL,
        entityId: input.billId,
        businessDate: new Date(),
        payloadSnapshot: {
          reason: input.reason,
          varianceAmount: input.varianceAmount,
          variancePercent: input.variancePercent,
        },
      });

      return { success: true };
    }),
});

export type BillRouter = typeof billRouter;
