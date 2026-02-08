import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import {
  RentalOrderStatus,
  RentalPaymentStatus,
  UnitStatus,
  UnitCondition,
  DepositPolicyType,
  DepositStatus,
  ReturnStatus,
  EntityType,
} from '@sync-erp/database';

export {
  RentalOrderStatus,
  RentalPaymentStatus,
  UnitStatus,
  UnitCondition,
  DepositPolicyType,
  DepositStatus,
  ReturnStatus,
  EntityType,
};
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
  type RentalOrderWithRelations,
} from '@sync-erp/shared';
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
            status: z.nativeEnum(RentalOrderStatus).optional(),
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
      .query(async ({ ctx, input }) => {
        return rentalService.listOrders(ctx.companyId, input);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(
        async ({
          ctx,
          input,
        }): Promise<RentalOrderWithRelations | null> => {
          return rentalService.getOrderById(ctx.companyId, input.id);
        }
      ),

    create: protectedProcedure
      .input(CreateRentalOrderSchema)
      .mutation(async ({ ctx, input }) => {
        return rentalService.createOrder(
          ctx.companyId,
          input,
          ctx.userId
        );
      }),

    confirm: protectedProcedure
      .input(ConfirmRentalOrderSchema)
      .mutation(async ({ ctx, input }) => {
        return rentalService.confirmOrder(
          ctx.companyId,
          input,
          ctx.userId
        );
      }),

    // Manual confirm with override options
    manualConfirm: protectedProcedure
      .input(ManualConfirmRentalOrderSchema)
      .mutation(async ({ ctx, input }) => {
        return rentalService.manualConfirmOrder(
          ctx.companyId,
          input,
          ctx.userId
        );
      }),

    release: protectedProcedure
      .input(ReleaseRentalOrderSchema)
      .mutation(async ({ ctx, input }) => {
        return rentalService.releaseOrder(
          ctx.companyId,
          input,
          ctx.userId
        );
      }),

    cancel: protectedProcedure
      .input(
        z.object({ orderId: z.string().uuid(), reason: z.string() })
      )
      .mutation(async ({ ctx, input }) => {
        return rentalService.cancelOrder(
          ctx.companyId,
          input.orderId,
          input.reason,
          ctx.userId
        );
      }),

    extend: protectedProcedure
      .input(ExtendRentalOrderSchema)
      .mutation(async ({ ctx, input }) => {
        return rentalService.extendOrder(
          ctx.companyId,
          input,
          ctx.userId
        );
      }),

    verifyPayment: protectedProcedure
      .input(
        z.object({
          orderId: z.string().uuid(),
          action: z.enum(['confirm', 'reject']),
          paymentReference: z.string().optional(),
          failReason: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return rentalService.verifyPayment(
          ctx.companyId,
          input.orderId,
          input.action,
          ctx.userId,
          input.paymentReference,
          input.failReason
        );
      }),
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
          status: z.nativeEnum(UnitStatus).optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        return rentalService.getUnitsByItem(
          ctx.companyId,
          input.itemId,
          input.status
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
