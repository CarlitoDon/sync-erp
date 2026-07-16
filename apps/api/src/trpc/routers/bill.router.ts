import { router, protectedProcedure } from '../trpc';
import { container, ServiceKeys } from '../../modules/common/di';
import {
  IdempotencyScope,
  AuditLogAction,
  EntityType,
} from '@sync-erp/database';
<<<<<<< HEAD
import {
  CancelBillInstallmentSchema,
  CreateBillFromPOSchema,
  CreateBillInstallmentScheduleSchema,
  ListBillInstallmentsSchema,
  MarkBillInstallmentPaidSchema,
} from '@sync-erp/shared';
import { z } from 'zod';
import { BillService } from '../../modules/accounting/services/bill.service';
import { BillInstallmentService } from '../../modules/accounting/services/bill-installment.service';
=======
import { CreateBillFromPOSchema } from '@sync-erp/shared';
import { z } from 'zod';
import { BillService } from '../../modules/accounting/services/bill.service';
>>>>>>> origin/dev
import { ensureHasPermission } from '../../modules/common/utils/permission.utils';
import { recordAudit } from '../../modules/common/audit/audit-log.service';

const billService = container.resolve<BillService>(
  ServiceKeys.BILL_SERVICE
);
<<<<<<< HEAD
const billInstallmentService = new BillInstallmentService();
=======
>>>>>>> origin/dev

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
    .meta({ idempotencyScope: IdempotencyScope.BILL_CREATE })
    .input(CreateBillFromPOSchema)
    .mutation(async ({ ctx, input }) => {
      return billService.createFromPurchaseOrder(
        ctx.companyId,
        input
      );
    }),

  /**
   * Create Down Payment Bill for PO with DP requirement
<<<<<<< HEAD
   */
  createDpBill: protectedProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        amount: z.number().positive().optional(), // Custom DP amount (optional)
      })
    )
=======
   */
  createDpBill: protectedProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        amount: z.number().positive().optional(), // Custom DP amount (optional)
      })
    )
    .mutation(async ({ ctx, input }) => {
      return billService.createDownPaymentBill(
        ctx.companyId,
        input.orderId,
        input.amount
      );
    }),

  /**
   * Post bill to ledger
   */
  post: protectedProcedure
    .meta({ idempotencyScope: IdempotencyScope.INVOICE_POST }) // Bills are posted as Invoices in ledger
    .input(z.object({ id: z.string().uuid() }))
>>>>>>> origin/dev
    .mutation(async ({ ctx, input }) => {
      return billService.createDownPaymentBill(
        ctx.companyId,
        input.orderId,
        input.amount
      );
    }),

  /**
<<<<<<< HEAD
   * Post bill to ledger
   */
  post: protectedProcedure
    .meta({ idempotencyScope: IdempotencyScope.INVOICE_POST }) // Bills are posted as Invoices in ledger
    .input(
      z.object({
        id: z.string().uuid(),
        businessDate: z.coerce.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return billService.post(
        input.id,
        ctx.companyId,
        input.businessDate,
        ctx.userId
      );
    }),

  /**
=======
>>>>>>> origin/dev
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
   * Delete DRAFT bill
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // FR-026: Granular RBAC Check
      ensureHasPermission(ctx.userPermissions, 'FINANCE:DELETE');

      return billService.delete(input.id, ctx.companyId);
    }),

<<<<<<< HEAD
  installments: router({
    list: protectedProcedure
      .input(ListBillInstallmentsSchema)
      .query(async ({ ctx, input }) => {
        return billInstallmentService.list(ctx.companyId, input.billId);
      }),

    createSchedule: protectedProcedure
      .input(CreateBillInstallmentScheduleSchema)
      .mutation(async ({ ctx, input }) => {
        return billInstallmentService.createSchedule(
          ctx.companyId,
          input
        );
      }),

    markPaid: protectedProcedure
      .input(MarkBillInstallmentPaidSchema)
      .mutation(async ({ ctx, input }) => {
        return billInstallmentService.markPaid(ctx.companyId, input);
      }),

    cancel: protectedProcedure
      .input(CancelBillInstallmentSchema)
      .mutation(async ({ ctx, input }) => {
        return billInstallmentService.cancel(ctx.companyId, input);
      }),
  }),

=======
>>>>>>> origin/dev
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
