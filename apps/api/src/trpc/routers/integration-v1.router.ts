import { TRPCError } from '@trpc/server';
import { IdempotencyScope } from '@sync-erp/database';
import {
  apiKeyProcedure,
  publicProcedure,
  requirePermission,
  router,
} from '../trpc';
import { RentalExternalOrderService } from '../../modules/rental/rental-external-order.service';
import {
  RentalIntegrationCancelOrderSchema,
  RentalIntegrationClaimPaymentSchema,
  RentalIntegrationConfirmPaymentSchema,
  RentalIntegrationCreateOrderSchema,
  RentalIntegrationCustomerSchema,
  RentalIntegrationRejectPaymentSchema,
  RentalIntegrationUpdateOrderSchema,
} from '../../modules/rental/rental-integration.schemas';
import {
  toIntegrationCustomerDto,
  toIntegrationOrderDto,
  toIntegrationOrderSummaryDto,
} from '../../modules/rental/rental-integration.dto';

const service = new RentalExternalOrderService();

const assertCompanyScope = (
  inputCompanyId: string | undefined,
  ctxCompanyId: string
) => {
  if (inputCompanyId && inputCompanyId !== ctxCompanyId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'API key company mismatch',
    });
  }
};

export const integrationV1Router = router({
  rental: router({
    customers: router({
      create: apiKeyProcedure
        .use(requirePermission('rental:write'))
        .input(RentalIntegrationCustomerSchema)
        .mutation(async ({ ctx, input }) => {
          assertCompanyScope(input.companyId, ctx.companyId);
          const customer = await service.findOrCreateCustomer(
            ctx.companyId,
            input
          );

          return toIntegrationCustomerDto(customer);
        }),
    }),
    orders: router({
      create: apiKeyProcedure
        .use(requirePermission('rental:write'))
        .meta({ idempotencyScope: IdempotencyScope.ORDER_CREATE })
        .input(RentalIntegrationCreateOrderSchema)
        .mutation(async ({ ctx, input }) => {
          assertCompanyScope(input.companyId, ctx.companyId);
          const order = await service.createOrder({
            ...input,
            companyId: ctx.companyId,
            createdByApiKeyId: ctx.apiKeyId,
          });

          return toIntegrationOrderSummaryDto(order);
        }),
      get: apiKeyProcedure
        .use(requirePermission('rental:read'))
        .input(RentalIntegrationUpdateOrderSchema.pick({ id: true }))
        .query(async ({ ctx, input }) => {
          if (!input.id) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Order id is required',
            });
          }

          return toIntegrationOrderDto(
            await service.getById(ctx.companyId, input.id)
          );
        }),
      getByToken: publicProcedure
        .input(RentalIntegrationClaimPaymentSchema.pick({ token: true }))
        .query(async ({ input }) => {
          return toIntegrationOrderDto(await service.getByToken(input.token));
        }),
      getByOrderNumber: apiKeyProcedure
        .use(requirePermission('rental:read'))
        .input(RentalIntegrationConfirmPaymentSchema.pick({ orderNumber: true }))
        .query(async ({ ctx, input }) => {
          return toIntegrationOrderDto(
            await service.getByOrderNumber(
              ctx.companyId,
              input.orderNumber
            )
          );
        }),
      update: apiKeyProcedure
        .use(requirePermission('rental:write'))
        .input(RentalIntegrationUpdateOrderSchema)
        .mutation(async ({ ctx, input }) => {
          const token =
            input.token ||
            (input.id
              ? (await service.getById(ctx.companyId, input.id)).publicToken
              : undefined);

          if (!token) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Order token or id is required',
            });
          }

          const updated = await service.updateOrder(
            {
              ...input,
              token,
            },
            ctx.companyId
          );

          return toIntegrationOrderSummaryDto(updated);
        }),
      cancel: apiKeyProcedure
        .use(requirePermission('rental:write'))
        .input(
          RentalIntegrationCancelOrderSchema.extend({
            id: RentalIntegrationUpdateOrderSchema.shape.id.unwrap(),
          })
        )
        .mutation(async ({ ctx, input }) => {
          const cancelled = await service.cancelOrder({
            id: input.id,
            companyId: ctx.companyId,
            reason: input.reason,
          });

          return toIntegrationOrderSummaryDto(cancelled);
        }),
    }),
    payments: router({
      claim: apiKeyProcedure
        .use(requirePermission('rental:write'))
        .meta({ idempotencyScope: IdempotencyScope.PAYMENT_CREATE })
        .input(RentalIntegrationClaimPaymentSchema)
        .mutation(async ({ ctx, input }) => {
          return service.claimPayment(ctx.companyId, input);
        }),
      confirm: apiKeyProcedure
        .use(requirePermission('rental:write'))
        .input(RentalIntegrationConfirmPaymentSchema)
        .mutation(async ({ ctx, input }) => {
          return service.confirmPaymentByOrderNumber(ctx.companyId, input);
        }),
      reject: apiKeyProcedure
        .use(requirePermission('rental:write'))
        .input(RentalIntegrationRejectPaymentSchema)
        .mutation(async ({ ctx, input }) => {
          return service.rejectPaymentByOrderNumber(ctx.companyId, input);
        }),
    }),
  }),
});

export type IntegrationV1Router = typeof integrationV1Router;
