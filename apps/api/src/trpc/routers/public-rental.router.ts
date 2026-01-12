import { router, publicProcedure } from '../trpc';
import { z } from 'zod';
import {
  prisma,
  PartnerType,
  RentalOrderStatus,
} from '@sync-erp/database';
import { TRPCError } from '@trpc/server';

/**
 * Public Rental Router
 *
 * Unauthenticated endpoints for external clients (santi-living erp-sync-service).
 * These endpoints use publicToken for access control instead of user auth.
 */
export const publicRentalRouter = router({
  /**
   * Get order by public token
   * Used by customer order tracking page
   */
  getByToken: publicProcedure
    .input(z.object({ token: z.string().uuid() }))
    .query(async ({ input }) => {
      const order = await prisma.rentalOrder.findFirst({
        where: { publicToken: input.token },
        include: {
          partner: {
            select: {
              name: true,
              phone: true,
              address: true,
              street: true,
              kelurahan: true,
              kecamatan: true,
              kota: true,
              provinsi: true,
              zip: true,
              latitude: true,
              longitude: true,
            },
          },
          items: {
            include: {
              rentalItem: {
                include: {
                  product: {
                    select: {
                      name: true,
                      sku: true,
                    },
                  },
                },
              },
              rentalBundle: {
                select: {
                  name: true,
                  shortName: true,
                },
              },
            },
          },
        },
      });

      if (!order) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Order not found',
        });
      }

      // Return all fields including santi-living integration fields
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

        // Santi Living address fields (separate columns)
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

        // Relations
        partner: order.partner,
        items: order.items.map((item) => ({
          name:
            item.rentalItem?.product?.name ||
            item.rentalBundle?.name ||
            'Unknown',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
        })),
      };
    }),

  /**
   * Find or create partner by phone
   * Used when creating orders from santi-living
   */
  findOrCreatePartner: publicProcedure
    .input(
      z.object({
        companyId: z.string().min(1),
        name: z.string().min(2),
        phone: z.string().min(10),
        email: z.string().email().optional(),
        // Address fields (all separate)
        address: z.string().optional(),
        street: z.string().optional(),
        kelurahan: z.string().optional(),
        kecamatan: z.string().optional(),
        kota: z.string().optional(),
        provinsi: z.string().optional(),
        zip: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Normalize phone number
      let normalizedPhone = input.phone.replace(/\D/g, '');
      if (normalizedPhone.startsWith('0')) {
        normalizedPhone = '62' + normalizedPhone.slice(1);
      }

      // Try to find existing partner by phone
      let partner = await prisma.partner.findFirst({
        where: {
          companyId: input.companyId,
          phone: normalizedPhone,
        },
      });

      if (!partner) {
        // Create new partner with all address fields
        partner = await prisma.partner.create({
          data: {
            companyId: input.companyId,
            name: input.name,
            phone: normalizedPhone,
            email: input.email,
            address: input.address,
            street: input.street,
            kelurahan: input.kelurahan,
            kecamatan: input.kecamatan,
            kota: input.kota,
            provinsi: input.provinsi,
            zip: input.zip,
            latitude: input.latitude,
            longitude: input.longitude,
            type: PartnerType.CUSTOMER,
          },
        });
      } else {
        // Update existing partner with new address data if provided
        partner = await prisma.partner.update({
          where: { id: partner.id },
          data: {
            name: input.name,
            address: input.address,
            street: input.street,
            kelurahan: input.kelurahan,
            kecamatan: input.kecamatan,
            kota: input.kota,
            provinsi: input.provinsi,
            zip: input.zip,
            latitude: input.latitude,
            longitude: input.longitude,
          },
        });
      }

      return partner;
    }),

  /**
   * Create rental order from external source
   * Creates order in DRAFT status, to be confirmed by admin
   */
  createOrder: publicProcedure
    .input(
      z.object({
        companyId: z.string().min(1),
        partnerId: z.string().min(1),
        rentalStartDate: z.coerce.date(),
        rentalEndDate: z.coerce.date(),
        items: z.array(
          z.object({
            rentalItemId: z.string().min(1),
            quantity: z.number().int().positive(),
          })
        ),
        notes: z.string().optional(),

        // Santi Living integration fields (all separate)
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
      // Fetch rental items for pricing - try by ID first, then by name for santi-living
      let rentalItems = await prisma.rentalItem.findMany({
        where: {
          id: { in: input.items.map((i) => i.rentalItemId) },
          companyId: input.companyId,
        },
      });

      // If not found by ID, try by name (for santi-living integration)
      if (rentalItems.length !== input.items.length) {
        // Try lookup by product name
        const itemNames = input.items.map((i) => i.rentalItemId);
        const rentalItemsByName = await prisma.rentalItem.findMany({
          where: {
            companyId: input.companyId,
            product: {
              name: { in: itemNames, mode: 'insensitive' },
            },
          },
          include: { product: true },
        });

        // If still not found, auto-create rental items for santi-living
        if (rentalItemsByName.length === 0) {
          // Create products and rental items on the fly for santi-living orders
          const createdItems = [];
          for (const item of input.items) {
            // Create product
            const product = await prisma.product.create({
              data: {
                companyId: input.companyId,
                sku: `SL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name: item.rentalItemId, // Use the name as product name
                price: 0,
              },
            });

            // Create rental item linked to product
            const rentalItem = await prisma.rentalItem.create({
              data: {
                companyId: input.companyId,
                productId: product.id,
                dailyRate: 30000, // Default daily rate
                weeklyRate: 180000,
                monthlyRate: 600000,
                depositPolicyType: 'PERCENTAGE',
                depositPercentage: 0,
                isActive: true,
              },
            });
            createdItems.push(rentalItem);
          }
          rentalItems = createdItems;
        } else {
          rentalItems = rentalItemsByName;
        }
      }

      // Calculate duration and pricing
      const durationDays = Math.ceil(
        (input.rentalEndDate.getTime() -
          input.rentalStartDate.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      // Calculate subtotal (simplified: daily rate * days * quantity)
      let subtotal = 0;
      const orderItems = input.items.map((item, index) => {
        // Try to find by ID first, then by index (for auto-created items)
        let rentalItem = rentalItems.find(
          (r) => r.id === item.rentalItemId
        );
        // If not found by ID, use index-based mapping (auto-created items)
        if (!rentalItem && rentalItems[index]) {
          rentalItem = rentalItems[index];
        }

        if (!rentalItem) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Rental item not found for: ${item.rentalItemId}`,
          });
        }

        const itemTotal =
          Number(rentalItem.dailyRate) * durationDays * item.quantity;
        subtotal += itemTotal;
        return {
          rentalItemId: rentalItem.id, // Use actual ID, not input ID
          quantity: item.quantity,
          unitPrice: rentalItem.dailyRate,
          subtotal: itemTotal,
          pricingTier: 'DAILY' as const,
        };
      });

      // Apply discount if provided
      const finalSubtotal = subtotal - (input.discountAmount || 0);
      const totalAmount = finalSubtotal + (input.deliveryFee || 0);

      // Generate order number
      const orderCount = await prisma.rentalOrder.count({
        where: { companyId: input.companyId },
      });
      const orderNumber = `RNT-${String(orderCount + 1).padStart(6, '0')}`;

      // Create order with all santi-living integration fields
      const order = await prisma.rentalOrder.create({
        data: {
          companyId: input.companyId,
          partnerId: input.partnerId,
          orderNumber,
          rentalStartDate: input.rentalStartDate,
          rentalEndDate: input.rentalEndDate,
          dueDateTime: input.rentalEndDate,
          status: RentalOrderStatus.DRAFT,
          subtotal,
          depositAmount: 0,
          totalAmount,
          policySnapshot: {},
          notes: input.notes,
          createdBy: 'santi-living-website',

          // Santi Living integration fields (all separate)
          deliveryFee: input.deliveryFee,
          deliveryAddress: input.deliveryAddress,
          street: input.street,
          kelurahan: input.kelurahan,
          kecamatan: input.kecamatan,
          kota: input.kota,
          provinsi: input.provinsi,
          zip: input.zip,
          latitude: input.latitude,
          longitude: input.longitude,
          paymentMethod: input.paymentMethod,
          discountAmount: input.discountAmount,
          discountLabel: input.discountLabel,
          orderSource: 'website',

          items: {
            create: orderItems,
          },
        },
        include: {
          items: true,
        },
      });

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        publicToken: order.publicToken || order.id,
        status: order.status,
        createdAt: order.createdAt,
      };
    }),
});

export type PublicRentalRouter = typeof publicRentalRouter;
