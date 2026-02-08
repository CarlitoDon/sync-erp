import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { PaymentMethodType } from '@sync-erp/database';
import * as paymentMethodService from '../../modules/common/payment-method.service';

// Zod schema using string enum for proper type inference
const PaymentMethodTypeEnum = z.enum([
  'CASH',
  'BANK',
  'QRIS',
  'EWALLET',
  'OTHER',
]);

export const paymentMethodRouter = router({
  /**
   * List all payment methods for the company
   */
  list: protectedProcedure
    .input(
      z
        .object({
          includeInactive: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return paymentMethodService.list({
        companyId: ctx.companyId,
        includeInactive: input?.includeInactive,
      });
    }),

  /**
   * Get payment method by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return paymentMethodService.getById({
        id: input.id,
        companyId: ctx.companyId,
      });
    }),

  /**
   * Create a new payment method
   */
  create: protectedProcedure
    .input(
      z.object({
        code: z.string().min(1).max(50),
        name: z.string().min(1).max(100),
        type: PaymentMethodTypeEnum,
        accountId: z.string().uuid().nullish(),
        isDefault: z.boolean().default(false),
        sortOrder: z.number().int().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return paymentMethodService.create({
        companyId: ctx.companyId,
        code: input.code,
        name: input.name,
        type: input.type as PaymentMethodType,
        accountId: input.accountId ?? null,
        isDefault: input.isDefault,
        sortOrder: input.sortOrder,
      });
    }),

  /**
   * Update a payment method
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: z.object({
          code: z.string().min(1).max(50).optional(),
          name: z.string().min(1).max(100).optional(),
          type: PaymentMethodTypeEnum.optional(),
          accountId: z.string().uuid().nullish(),
          isActive: z.boolean().optional(),
          isDefault: z.boolean().optional(),
          sortOrder: z.number().int().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return paymentMethodService.update({
        id: input.id,
        companyId: ctx.companyId,
        data: {
          ...input.data,
          type: input.data.type as PaymentMethodType | undefined,
        },
      });
    }),

  /**
   * Delete a payment method
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return paymentMethodService.remove({
        id: input.id,
        companyId: ctx.companyId,
      });
    }),

  /**
   * Seed default payment methods for the company
   */
  seedDefaults: protectedProcedure.mutation(async ({ ctx }) => {
    return paymentMethodService.seedDefaults({
      companyId: ctx.companyId,
    });
  }),
});

export type PaymentMethodRouter = typeof paymentMethodRouter;
