/**
 * Public Rental Order Router
 *
 * Handles order lifecycle: creation, retrieval, and deletion.
 * Extracted from public-rental.router.ts for maintainability.
 * NOW DELEGATES TO RentalExternalOrderService.
 */

import { publicProcedure, apiKeyProcedure, router } from '../../trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { RentalExternalOrderService } from '../../../modules/rental/rental-external-order.service';
import { DomainError } from '@sync-erp/shared';

const service = new RentalExternalOrderService();

export const publicRentalOrderRouter = router({
  /**
   * Get order by public token
   * Used by customer order tracking page
   */
  getByToken: publicProcedure
    .input(z.object({ token: z.string().uuid() }))
    .query(async ({ input }) => {
      try {
        const order = await service.getByToken(input.token);

        // Map to expected response format (copying the mapping logic here or in service?
        // Service returns the Prisma object with relations.
        // We need to map it to the DTO expected by the frontend.)

        // Since the service returns the full object with relations, we can map it here.
        // This keeps the service clean (just data access/domain logic) and router handles DTO mapping.

        return {
          orderNumber: order.orderNumber,
          status: order.status,
          rentalStartDate: order.rentalStartDate,
          rentalEndDate: order.rentalEndDate,
          subtotal: order.subtotal,
          totalAmount: order.totalAmount,
          depositAmount: order.depositAmount,
          notes: order.notes,
          createdAt: order.createdAt,

          // Santi Living address fields
          deliveryFee: order.deliveryFee,
          deliveryAddress: order.deliveryAddress,
          street: order.street,
          kelurahan: order.kelurahan,
          kecamatan: order.kecamatan,
          kota: order.kota,
          provinsi: order.provinsi,
          zip: order.zip,
          latitude: order.latitude,
          longitude: order.longitude,
          paymentMethod: order.paymentMethod,
          discountAmount: order.discountAmount,
          discountLabel: order.discountLabel,
          orderSource: order.orderSource,

          // Payment status fields
          rentalPaymentStatus: order.rentalPaymentStatus,
          paymentClaimedAt: order.paymentClaimedAt,
          paymentConfirmedAt: order.paymentConfirmedAt,
          paymentReference: order.paymentReference,
          paymentFailedAt: order.paymentFailedAt,
          paymentFailReason: order.paymentFailReason,

          // Relations
          partner: order.partner,
          items: order.items.map((item) => ({
            rentalItemId: item.rentalItemId,
            rentalBundleId: item.rentalBundleId,
            name:
              item.rentalItem?.product?.name ||
              item.rentalBundle?.name ||
              'Unknown',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
          })),
        };
      } catch (err) {
        if (err instanceof DomainError) {
          throw new TRPCError({
            code:
              err.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'BAD_REQUEST',
            message: err.message,
            cause: err,
          });
        }
        throw err;
      }
    }),

  /**
   * Create rental order from external source
   * Creates order in DRAFT status, to be confirmed by admin
   * Auto-creates bundles/items if not found (for santi-living integration)
   */
  createOrder: apiKeyProcedure
    .input(
      z.object({
        companyId: z.string().min(1),
        partnerId: z.string().min(1),
        rentalStartDate: z.coerce.date(),
        rentalEndDate: z.coerce.date(),
        items: z.array(
          z
            .object({
              rentalItemId: z.string().min(1).optional(),
              rentalBundleId: z.string().min(1).optional(),
              quantity: z.number().int().positive(),
              // Metadata for auto-creation (from santi-living)
              name: z.string().optional(),
              pricePerDay: z.number().positive().optional(),
              category: z
                .enum(['package', 'mattress', 'accessory'])
                .optional(),
              // Bundle components for auto-creation
              components: z.array(z.string()).optional(),
            })
            .refine(
              (data) => !!data.rentalItemId || !!data.rentalBundleId,
              {
                message:
                  'Either rentalItemId or rentalBundleId is required',
              }
            )
        ),
        notes: z.string().optional(),

        // Santi Living integration fields
        deliveryFee: z.number().nonnegative().optional(),
        deliveryAddress: z.string().optional(),
        street: z.string().optional(),
        kelurahan: z.string().optional(),
        kecamatan: z.string().optional(),
        kota: z.string().optional(),
        provinsi: z.string().optional(),
        zip: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        paymentMethod: z.string().optional(),
        discountAmount: z.number().nonnegative().optional(),
        discountLabel: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const order = await service.createOrder(input);

        return {
          id: order.id,
          orderNumber: order.orderNumber,
          publicToken: order.publicToken || order.id,
          status: order.status,
          createdAt: order.createdAt,
        };
      } catch (err) {
        if (err instanceof DomainError) {
          throw new TRPCError({
            code:
              err.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'BAD_REQUEST',
            message: err.message,
            cause: err,
          });
        }
        throw err;
      }
    }),

  /**
   * Update order by public token
   * Used by santi-living "Edit Pesanan" flow to update customer info, items, dates, etc.
   * Only DRAFT orders with PENDING payment can be updated.
   */
  updateOrder: apiKeyProcedure
    .input(
      z.object({
        token: z.string().uuid(),
        // Customer info
        customerName: z.string().min(1).optional(),
        customerPhone: z.string().optional(),
        // Order fields
        rentalStartDate: z.coerce.date().optional(),
        rentalEndDate: z.coerce.date().optional(),
        notes: z.string().optional(),
        // Address fields
        deliveryFee: z.number().nonnegative().optional(),
        deliveryAddress: z.string().optional(),
        street: z.string().optional(),
        kelurahan: z.string().optional(),
        kecamatan: z.string().optional(),
        kota: z.string().optional(),
        provinsi: z.string().optional(),
        zip: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        paymentMethod: z.string().optional(),
        discountAmount: z.number().nonnegative().optional(),
        discountLabel: z.string().optional(),
        // Items replacement
        items: z
          .array(
            z.object({
              rentalItemId: z.string().min(1).optional(),
              rentalBundleId: z.string().min(1).optional(),
              quantity: z.number().int().positive(),
              name: z.string().optional(),
              pricePerDay: z.number().positive().optional(),
              category: z
                .enum(['package', 'mattress', 'accessory'])
                .optional(),
              components: z.array(z.string()).optional(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const updated = await service.updateOrder(input);

        return {
          id: updated.id,
          orderNumber: updated.orderNumber,
          publicToken: updated.publicToken || updated.id,
          status: updated.status,
          totalAmount: Number(updated.totalAmount),
        };
      } catch (err) {
        if (err instanceof DomainError) {
          throw new TRPCError({
            code:
              err.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'BAD_REQUEST',
            message: err.message,
            cause: err,
          });
        }
        throw err;
      }
    }),

  /**
   * Delete order by ID (Internal/Rollback Use)
   * Used by santi-living to rollback invalid orders
   */
  deleteOrder: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      try {
        await service.deleteOrder(input.id);
        return { success: true };
      } catch (err) {
        if (err instanceof DomainError) {
          throw new TRPCError({
            code:
              err.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'BAD_REQUEST',
            message: err.message,
            cause: err,
          });
        }
        throw err;
      }
    }),
});
