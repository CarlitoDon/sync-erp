import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';

import {
  CreateRentalItemSchema,
  UpdateUnitStatusSchema,
  CreateRentalOrderSchema,
  ConfirmRentalOrderSchema,
  ManualConfirmRentalOrderSchema,
  ReleaseRentalOrderSchema,
  ProcessReturnSchema,
  UpdateRentalPolicySchema,
  ExtendRentalOrderSchema,
  CreateInvoiceFromReturnSchema,
  ConvertStockToUnitSchema,
  type RentalItemWithRelations,
  ApiRentalOrderStatusSchema,
  ApiUnitStatusSchema,
  PortableRentalOrder,
} from '@sync-erp/shared';
import type {
  RentalOrderStatus,
  UnitStatus,
} from '@sync-erp/database';
import { RentalService } from '../../modules/rental/rental.service';
import { container, ServiceKeys } from '../../modules/common/di';

const rentalService = container.resolve<RentalService>(
  ServiceKeys.RENTAL_SERVICE
);

// ==========================================
// Router Definition
// ==========================================

export const rentalRouter = router({
  // ==========================================
  // Items Management
  // ==========================================
  items: router({
    list: protectedProcedure
      .input(
        z
          .object({
            category: z.string().optional(),
            isActive: z.boolean().optional(),
          })
          .optional()
      )
      .query(
        async ({
          ctx,
          input,
        }): Promise<RentalItemWithRelations[]> => {
          return rentalService.listItems(ctx.companyId, input);
        }
      ),

    create: protectedProcedure
      .input(CreateRentalItemSchema)
      .mutation(async ({ ctx, input }) => {
        return rentalService.createItem(
          ctx.companyId,
          input,
          ctx.userId
        );
      }),

    convertStock: protectedProcedure
      .input(ConvertStockToUnitSchema)
      .mutation(async ({ ctx, input }) => {
        return rentalService.convertStockToUnits(
          ctx.companyId,
          input.rentalItemId,
          input.quantity,
          ctx.userId
        );
      }),

    updateUnitStatus: protectedProcedure
      .input(UpdateUnitStatusSchema)
      .mutation(async ({ ctx, input }) => {
        return rentalService.updateUnitStatus(
          ctx.companyId,
          input.unitId,
          input.status,
          input.reason,
          ctx.userId
        );
      }),
  }),

  // ==========================================
  // Orders Management
  // ==========================================
  orders: router({
    list: protectedProcedure
      .input(
        z
          .object({
            status: ApiRentalOrderStatusSchema.optional(),
            partnerId: z.string().uuid().optional(),
            dateRange: z
              .object({
                start: z.coerce.date(),
                end: z.coerce.date(),
              })
              .optional(),
            take: z.number().min(1).max(100).default(50),
            cursor: z.string().uuid().optional(),
          })
          .optional()
      )
      .query(
        async ({
          ctx,
          input,
        }): Promise<{
          items: PortableRentalOrder[];
          nextCursor: string | null;
        }> => {
          const result = await rentalService.listOrders(
            ctx.companyId,
            {
              ...input,
              status: input?.status as RentalOrderStatus | undefined,
            }
          );
          return result as unknown as {
            items: PortableRentalOrder[];
            nextCursor: string | null;
          };
        }
      ),

    getById: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(
        async ({
          ctx,
          input,
        }): Promise<PortableRentalOrder | null> => {
          const result = await rentalService.getOrderById(
            ctx.companyId,
            input.id
          );
          return result as PortableRentalOrder | null;
        }
      ),

    create: protectedProcedure
      .input(CreateRentalOrderSchema)
      .mutation(
        async ({ ctx, input }): Promise<PortableRentalOrder> => {
          const result = await rentalService.createOrder(
            ctx.companyId,
            input,
            ctx.userId
          );
          return result as PortableRentalOrder;
        }
      ),

    confirm: protectedProcedure
      .input(ConfirmRentalOrderSchema)
      .mutation(
        async ({ ctx, input }): Promise<PortableRentalOrder> => {
          const result = await rentalService.confirmOrder(
            ctx.companyId,
            input,
            ctx.userId
          );
          return result as PortableRentalOrder;
        }
      ),

    // Manual confirm with override options
    manualConfirm: protectedProcedure
      .input(ManualConfirmRentalOrderSchema)
      .mutation(
        async ({ ctx, input }): Promise<PortableRentalOrder> => {
          const result = await rentalService.manualConfirmOrder(
            ctx.companyId,
            input,
            ctx.userId
          );
          return result as PortableRentalOrder;
        }
      ),

    release: protectedProcedure
      .input(ReleaseRentalOrderSchema)
      .mutation(
        async ({ ctx, input }): Promise<PortableRentalOrder> => {
          const result = await rentalService.releaseOrder(
            ctx.companyId,
            input,
            ctx.userId
          );
          return result as PortableRentalOrder;
        }
      ),

    cancel: protectedProcedure
      .input(
        z.object({ orderId: z.string().uuid(), reason: z.string() })
      )
      .mutation(
        async ({ ctx, input }): Promise<PortableRentalOrder> => {
          const result = await rentalService.cancelOrder(
            ctx.companyId,
            input.orderId,
            input.reason,
            ctx.userId
          );
          return result as PortableRentalOrder;
        }
      ),

    extend: protectedProcedure
      .input(ExtendRentalOrderSchema)
      .mutation(
        async ({ ctx, input }): Promise<PortableRentalOrder> => {
          const result = await rentalService.extendOrder(
            ctx.companyId,
            input,
            ctx.userId
          );
          return result as PortableRentalOrder;
        }
      ),

    verifyPayment: protectedProcedure
      .input(
        z.object({
          orderId: z.string().uuid(),
          action: z.enum(['confirm', 'reject']),
          paymentReference: z.string().optional(),
          failReason: z.string().optional(),
        })
      )
      .mutation(
        async ({ ctx, input }): Promise<PortableRentalOrder> => {
          const result = await rentalService.verifyPayment(
            ctx.companyId,
            input.orderId,
            input.action,
            ctx.userId,
            input.paymentReference,
            input.failReason
          );
          return result as PortableRentalOrder;
        }
      ),
  }),

  // ==========================================
  // Availability Queries
  // ==========================================
  availability: router({
    check: protectedProcedure
      .input(
        z.object({
          itemId: z.string().uuid().optional(),
          startDate: z.coerce.date(),
          endDate: z.coerce.date(),
        })
      )
      .query(async ({ ctx, input }) => {
        return rentalService.checkAvailability(
          ctx.companyId,
          input.startDate,
          input.endDate,
          input.itemId
        );
      }),

    getUnitsByItem: protectedProcedure
      .input(
        z.object({
          itemId: z.string().uuid(),
          status: ApiUnitStatusSchema.optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        return rentalService.getUnitsByItem(
          ctx.companyId,
          input.itemId,
          input.status as UnitStatus | undefined
        );
      }),

    // Get timeline data for scheduler view
    timeline: protectedProcedure
      .input(
        z.object({
          startDate: z.coerce.date(),
          endDate: z.coerce.date(),
        })
      )
      .query(async ({ ctx, input }) => {
        return rentalService.getSchedulerTimeline(
          ctx.companyId,
          input.startDate,
          input.endDate
        );
      }),
  }),

  // ==========================================
  // Returns & Settlement
  // ==========================================
  returns: router({
    process: protectedProcedure
      .input(ProcessReturnSchema)
      .mutation(async ({ ctx, input }) => {
        return rentalService.processReturn(
          ctx.companyId,
          input,
          ctx.userId
        );
      }),

    finalize: protectedProcedure
      .input(z.object({ returnId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        return rentalService.finalizeReturn(
          ctx.companyId,
          input.returnId,
          ctx.userId
        );
      }),

    createInvoice: protectedProcedure
      .input(CreateInvoiceFromReturnSchema)
      .mutation(async ({ ctx, input }) => {
        return rentalService.createInvoiceFromReturn(
          ctx.companyId,
          input.returnId
        );
      }),
  }),

  // ==========================================
  // Policy Management
  // ==========================================
  policy: router({
    getCurrent: protectedProcedure.query(async ({ ctx }) => {
      return rentalService.getCurrentPolicy(ctx.companyId);
    }),

    update: protectedProcedure
      .input(UpdateRentalPolicySchema)
      .mutation(async ({ ctx, input }) => {
        return rentalService.updatePolicy(
          ctx.companyId,
          input,
          ctx.userId
        );
      }),
  }),
});

export type RentalRouter = typeof rentalRouter;
