import { router, protectedProcedure } from '../trpc';
import { InvoiceService } from '../../modules/accounting/services/invoice.service';
import { CreateInvoiceFromSOSchema } from '@sync-erp/shared';
import { z } from 'zod';

const invoiceService = new InvoiceService();

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
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return invoiceService.post(input.id, ctx.companyId);
    }),

  /**
   * Void invoice
   */
  void: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return invoiceService.void(input.id, ctx.companyId);
    }),
});

export type InvoiceRouter = typeof invoiceRouter;
