import { router, protectedProcedure } from '../trpc';
import { container, ServiceKeys } from '../../modules/common/di';
import { IdempotencyScope } from '@sync-erp/database';
import { InvoiceService } from '../../modules/accounting/services/invoice.service';
import { CreateInvoiceFromSOSchema } from '@sync-erp/shared';
import { z } from 'zod';

const invoiceService = container.resolve<InvoiceService>(
  ServiceKeys.INVOICE_SERVICE
);

export const invoiceRouter = router({
  /**
   * List all invoices for current company
   */
  list: protectedProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return invoiceService.list(ctx.companyId, input?.status);
    }),

  /**
   * Get invoice by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return invoiceService.getById(input.id, ctx.companyId);
    }),

  /**
   * Create invoice from Sales Order
   */
  createFromSO: protectedProcedure
    .meta({ idempotencyScope: IdempotencyScope.INVOICE_CREATE })
    .input(CreateInvoiceFromSOSchema)
    .mutation(async ({ ctx, input }) => {
      return invoiceService.createFromSalesOrder(
        ctx.companyId,
        input
      );
    }),

  /**
   * Post invoice
   */
  post: protectedProcedure
    .meta({ idempotencyScope: IdempotencyScope.INVOICE_POST })
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return invoiceService.post(input.id, ctx.companyId);
    }),

  /**
   * Void invoice (FR-024: requires reason)
   */
  void: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().min(1, 'Void reason is required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return invoiceService.void(
        input.id,
        ctx.companyId,
        ctx.userId,
        input.reason,
        ctx.userPermissions // GAP-4 Fix: FR-026 pass permissions
      );
    }),
});

export type InvoiceRouter = typeof invoiceRouter;
