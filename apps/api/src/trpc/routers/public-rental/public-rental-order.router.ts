/**
 * Public Rental Order Router
 *
 * Handles order lifecycle: creation, retrieval, and deletion.
 * Extracted from public-rental.router.ts for maintainability.
 */

import { publicProcedure, apiKeyProcedure, router } from '../../trpc';
import { z } from 'zod';
import { Prisma } from '@sync-erp/database';
import { Decimal } from 'decimal.js';
import {
  prisma,
  RentalOrderStatus,
  RentalPaymentStatus,
  OrderSource,
} from '@sync-erp/database';
import { TRPCError } from '@trpc/server';
import { container, ServiceKeys } from '../../../modules/common/di';
import type { RentalWebhookService } from '../../../modules/rental/rental-webhook.service';

// Lazy resolve webhook service (for admin notifications - Santi Living specific)
const getWebhookService = (): RentalWebhookService | null => {
  try {
    return container.resolve<RentalWebhookService>(
      ServiceKeys.RENTAL_WEBHOOK_SERVICE
    );
  } catch {
    return null;
  }
};

export const publicRentalOrderRouter = router({
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

        // Payment status fields (for customer tracking)
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
              // Bundle components for auto-creation: ["kasur busa", "sprei", "bantal", "selimut"]
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
      // Get only items that have rentalItemId (not bundles)
      const itemsWithRentalItemId = input.items.filter(
        (i): i is typeof i & { rentalItemId: string } =>
          !!i.rentalItemId
      );

      // Fetch rental items for pricing - try by ID first, then by name for santi-living
      let rentalItems = await prisma.rentalItem.findMany({
        where: {
          id: {
            in: itemsWithRentalItemId.map((i) => i.rentalItemId),
          },
          companyId: input.companyId,
        },
      });

      // If not found by ID, try by name (for santi-living integration)
      if (
        itemsWithRentalItemId.length > 0 &&
        rentalItems.length !== itemsWithRentalItemId.length
      ) {
        // Try lookup by product name
        const itemNames = itemsWithRentalItemId.map(
          (i) => i.rentalItemId
        );
        const rentalItemsByName = await prisma.rentalItem.findMany({
          where: {
            companyId: input.companyId,
            product: {
              name: { in: itemNames, mode: 'insensitive' },
            },
          },
          include: { product: true },
        });

        // Merge with existing results - auto-creation will be handled
        // in the main loop with component-based matching
        if (rentalItemsByName.length > 0) {
          rentalItems = rentalItemsByName;
        }
        // NOTE: Removed early auto-create here - the main loop (below)
        // handles auto-creation with proper component SKU matching
      }

      // Calculate duration and pricing
      const durationDays = Math.ceil(
        (input.rentalEndDate.getTime() -
          input.rentalStartDate.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      // Calculate subtotal - handle both items and bundles
      let subtotal = 0;
      const orderItems = [];

      for (const item of input.items) {
        if (item.rentalBundleId) {
          // Bundle order - find bundle by ID or externalId
          let bundle = await prisma.rentalBundle.findFirst({
            where: {
              companyId: input.companyId,
              OR: [
                { id: item.rentalBundleId },
                { externalId: item.rentalBundleId },
              ],
            },
          });

          // Auto-create bundle if not found and metadata provided
          if (!bundle && item.name && item.pricePerDay) {
            // Create bundle with components in a transaction
            bundle = await prisma.$transaction(async (tx) => {
              // 1. Create the bundle
              const newBundle = await tx.rentalBundle.create({
                data: {
                  companyId: input.companyId,
                  externalId: item.rentalBundleId,
                  name: item.name!,
                  dailyRate: item.pricePerDay!,
                  weeklyRate: item.pricePerDay! * 6, // ~14% discount
                  monthlyRate: item.pricePerDay! * 25, // ~17% discount
                  isActive: true,
                },
              });

              // 2. Create components if provided
              if (item.components && item.components.length > 0) {
                for (const componentLabel of item.components) {
                  // Parse quantity from label (e.g., "2 bantal" -> quantity: 2, label: "bantal")
                  const quantityMatch =
                    componentLabel.match(/^(\d+)\s+(.+)$/);
                  const quantity = quantityMatch
                    ? parseInt(quantityMatch[1], 10)
                    : 1;
                  const label = quantityMatch
                    ? quantityMatch[2]
                    : componentLabel;

                  // Find or create the rental item for this component
                  let rentalItem = await tx.rentalItem.findFirst({
                    where: {
                      companyId: input.companyId,
                      product: {
                        name: {
                          contains: label,
                          mode: 'insensitive',
                        },
                      },
                    },
                  });

                  // If not found, create product and rental item
                  if (!rentalItem) {
                    const product = await tx.product.create({
                      data: {
                        companyId: input.companyId,
                        sku: `SL-${label.toLowerCase().replace(/\s+/g, '-')}`,
                        name:
                          label.charAt(0).toUpperCase() +
                          label.slice(1),
                        price: 0,
                      },
                    });

                    rentalItem = await tx.rentalItem.create({
                      data: {
                        companyId: input.companyId,
                        productId: product.id,
                        dailyRate: 5000, // Default component price
                        weeklyRate: 30000,
                        monthlyRate: 125000,
                        depositPolicyType: 'PERCENTAGE',
                        depositPercentage: 0,
                        isActive: true,
                      },
                    });
                  }

                  // Create the bundle component link
                  await tx.rentalBundleComponent.create({
                    data: {
                      bundleId: newBundle.id,
                      rentalItemId: rentalItem.id,
                      quantity,
                      componentLabel: label,
                    },
                  });
                }
              }

              return newBundle;
            });
          }

          if (!bundle) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Bundle not found: ${item.rentalBundleId}. Provide name, pricePerDay, and components for auto-creation.`,
            });
          }

          const itemTotal =
            Number(bundle.dailyRate) * durationDays * item.quantity;
          subtotal += itemTotal;
          orderItems.push({
            rentalBundleId: bundle.id,
            quantity: item.quantity,
            unitPrice: bundle.dailyRate,
            subtotal: itemTotal,
            pricingTier: 'DAILY' as const,
          });
        } else if (item.rentalItemId) {
          // Regular item order - try by ID first, then by name
          let rentalItem:
            | { id: string; dailyRate: Prisma.Decimal }
            | undefined = rentalItems.find(
            (r) => r.id === item.rentalItemId
          );
          // If not found by ID, try product name
          if (!rentalItem && item.rentalItemId) {
            rentalItem = rentalItems.find(
              (r) =>
                (
                  r as unknown as { product?: { name?: string } }
                ).product?.name?.toLowerCase() ===
                item.rentalItemId!.toLowerCase()
            );
          }

          // For mattress-only items with components, try to find by component SKU
          // This allows mattress-king to reuse "kasur busa 180x200" from package-king
          // FRESH query to handle items created earlier in the same order (e.g., bundle first)
          if (!rentalItem && item.components?.[0]) {
            const componentSku = `SL-${item.components[0].toLowerCase().replace(/\s+/g, '-')}`;

            const freshLookup = await prisma.rentalItem.findFirst({
              where: {
                companyId: input.companyId,
                product: { sku: componentSku },
              },
              include: { product: true },
            });

            if (freshLookup) {
              rentalItem = freshLookup;

              // Update dailyRate if mattress-only price is higher than bundle component price
              // This ensures standalone kasur uses correct price (e.g., 20000) not component price (5000)
              if (
                item.pricePerDay &&
                item.pricePerDay > Number(freshLookup.dailyRate)
              ) {
                await prisma.rentalItem.update({
                  where: { id: freshLookup.id },
                  data: {
                    dailyRate: item.pricePerDay,
                    weeklyRate: item.pricePerDay * 6,
                    monthlyRate: item.pricePerDay * 25,
                  },
                });
                // Update the reference so pricing calculation uses new rate
                rentalItem = {
                  ...freshLookup,
                  dailyRate: new Decimal(item.pricePerDay),
                };
              }
            }
          }

          // Auto-create rental item if not found and metadata provided
          if (!rentalItem && item.name && item.pricePerDay) {
            // For mattress-only items, use components[0] (e.g., "kasur busa 180x200")
            // so it matches the kasur component from packages
            const componentName = item.components?.[0];
            const productName = componentName
              ? componentName.charAt(0).toUpperCase() +
                componentName.slice(1)
              : item.name;
            const productSku = componentName
              ? `SL-${componentName.toLowerCase().replace(/\s+/g, '-')}`
              : `SL-${item.rentalItemId}`;

            // Check if product with this SKU already exists (e.g., kasur from a package)
            let product = await prisma.product.findFirst({
              where: {
                companyId: input.companyId,
                sku: productSku,
              },
            });

            if (!product) {
              // Create product if not exists
              product = await prisma.product.create({
                data: {
                  companyId: input.companyId,
                  sku: productSku,
                  name: productName,
                  price: 0,
                },
              });
            }

            // Check if rental item exists for this product
            const existingRentalItem =
              await prisma.rentalItem.findFirst({
                where: {
                  companyId: input.companyId,
                  productId: product.id,
                },
              });

            if (existingRentalItem) {
              rentalItem = existingRentalItem;
            } else {
              // Create rental item linked to product
              rentalItem = await prisma.rentalItem.create({
                data: {
                  companyId: input.companyId,
                  productId: product.id,
                  dailyRate: item.pricePerDay,
                  weeklyRate: item.pricePerDay * 6,
                  monthlyRate: item.pricePerDay * 25,
                  depositPolicyType: 'PERCENTAGE',
                  depositPercentage: 0,
                  isActive: true,
                },
              });
            }
          }

          if (!rentalItem) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Rental item not found for: ${item.rentalItemId}. Provide name and pricePerDay for auto-creation.`,
            });
          }

          const itemTotal =
            Number(rentalItem.dailyRate) *
            durationDays *
            item.quantity;
          subtotal += itemTotal;
          orderItems.push({
            rentalItemId: rentalItem.id,
            quantity: item.quantity,
            unitPrice: rentalItem.dailyRate,
            subtotal: itemTotal,
            pricingTier: 'DAILY' as const,
          });
        }
      }

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
          // Explicitly generate publicToken to ensure it matches returned value
          publicToken: crypto.randomUUID(),
          // Website orders start as DRAFT with PENDING payment status
          // Admin confirms after verifying payment → moves to CONFIRMED
          status: RentalOrderStatus.DRAFT,
          rentalPaymentStatus: RentalPaymentStatus.PENDING,
          subtotal,
          depositAmount: 0, // Will be calculated based on policy when confirmed
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
          orderSource: OrderSource.WEBSITE,

          items: {
            create: orderItems,
          },
        },
        include: {
          items: true,
          partner: {
            select: { name: true, phone: true },
          },
        },
      });

      // Fire webhook notification to admin & customer (Blocking to ensure WA validation)
      const webhookService = getWebhookService();
      if (webhookService && order.publicToken) {
        try {
          await webhookService.notifyNewOrder({
            token: order.publicToken,
            orderNumber: order.orderNumber,
            customerName: order.partner.name,
            customerPhone: order.partner.phone || '',
            totalAmount: Number(order.totalAmount),
          });
        } catch (err) {
          const errorMessage =
            err instanceof Error
              ? err.message
              : 'Unknown validation error';
          console.error(
            '[PublicRental] New order webhook/validation failed. Rolling back order:',
            errorMessage
          );

          // Attempt to rollback local order (in case erp-service didn't do it)
          try {
            await prisma.rentalOrderItem.deleteMany({
              where: { rentalOrderId: order.id },
            });
            await prisma.rentalOrder.delete({
              where: { id: order.id },
            });
            // eslint-disable-next-line no-console -- Rollback success log
            console.log(
              `[PublicRental] Rolled back order ${order.orderNumber}`
            );
          } catch (rollbackErr) {
            // Ignore if already deleted by erp-service
            console.warn(
              '[PublicRental] Rollback failed (likely already deleted):',
              rollbackErr
            );
          }

          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              errorMessage ||
              'Gagal validasi pesanan (WhatsApp tidak valid)',
            cause: err,
          });
        }
      }

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        publicToken: order.publicToken || order.id,
        status: order.status,
        createdAt: order.createdAt,
      };
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
        // Customer info (updated via partner)
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
        // Items replacement (full replace strategy)
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
      // 1. Find order by token
      const order = await prisma.rentalOrder.findFirst({
        where: { publicToken: input.token },
        include: { partner: true, items: true },
      });

      if (!order) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Order not found',
        });
      }

      // 2. Only DRAFT + PENDING payment orders can be edited
      if (order.status !== RentalOrderStatus.DRAFT) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only draft orders can be updated',
        });
      }

      if (
        order.rentalPaymentStatus &&
        order.rentalPaymentStatus !== RentalPaymentStatus.PENDING
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot update order with active payment',
        });
      }

      // 3. Update partner info if changed
      if (input.customerName || input.customerPhone) {
        const partnerUpdate: Record<string, unknown> = {};
        if (input.customerName)
          partnerUpdate.name = input.customerName;
        if (input.customerPhone)
          partnerUpdate.phone = input.customerPhone;
        if (input.deliveryAddress)
          partnerUpdate.address = input.deliveryAddress;
        if (input.street) partnerUpdate.street = input.street;
        if (input.kelurahan)
          partnerUpdate.kelurahan = input.kelurahan;
        if (input.kecamatan)
          partnerUpdate.kecamatan = input.kecamatan;
        if (input.kota) partnerUpdate.kota = input.kota;
        if (input.provinsi) partnerUpdate.provinsi = input.provinsi;
        if (input.zip) partnerUpdate.zip = input.zip;
        if (input.latitude !== undefined)
          partnerUpdate.latitude = input.latitude;
        if (input.longitude !== undefined)
          partnerUpdate.longitude = input.longitude;

        await prisma.partner.update({
          where: { id: order.partnerId },
          data: partnerUpdate,
        });
      }

      // 4. Recalculate items if provided
      const startDate =
        input.rentalStartDate || order.rentalStartDate;
      const endDate = input.rentalEndDate || order.rentalEndDate;
      const durationDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      let subtotal = Number(order.subtotal);
      let totalAmount = Number(order.totalAmount);

      if (input.items && input.items.length > 0) {
        // Delete existing items
        await prisma.rentalOrderItem.deleteMany({
          where: { rentalOrderId: order.id },
        });

        // Recalculate with new items
        subtotal = 0;
        const newOrderItems = [];

        for (const item of input.items) {
          if (item.rentalBundleId) {
            const bundle = await prisma.rentalBundle.findFirst({
              where: {
                companyId: order.companyId,
                OR: [
                  { id: item.rentalBundleId },
                  { externalId: item.rentalBundleId },
                ],
              },
            });

            if (bundle) {
              const itemTotal =
                Number(bundle.dailyRate) *
                durationDays *
                item.quantity;
              subtotal += itemTotal;
              newOrderItems.push({
                rentalOrderId: order.id,
                rentalBundleId: bundle.id,
                quantity: item.quantity,
                unitPrice: bundle.dailyRate,
                subtotal: itemTotal,
                pricingTier: 'DAILY' as const,
              });
            }
          } else if (item.rentalItemId) {
            let rentalItem = await prisma.rentalItem.findFirst({
              where: {
                companyId: order.companyId,
                OR: [
                  { id: item.rentalItemId },
                  {
                    product: {
                      name: {
                        equals: item.rentalItemId,
                        mode: 'insensitive',
                      },
                    },
                  },
                ],
              },
            });

            // Try component SKU lookup
            if (!rentalItem && item.components?.[0]) {
              const componentSku = `SL-${item.components[0].toLowerCase().replace(/\s+/g, '-')}`;
              rentalItem = await prisma.rentalItem.findFirst({
                where: {
                  companyId: order.companyId,
                  product: { sku: componentSku },
                },
              });
            }

            if (rentalItem) {
              const itemTotal =
                Number(rentalItem.dailyRate) *
                durationDays *
                item.quantity;
              subtotal += itemTotal;
              newOrderItems.push({
                rentalOrderId: order.id,
                rentalItemId: rentalItem.id,
                quantity: item.quantity,
                unitPrice: rentalItem.dailyRate,
                subtotal: itemTotal,
                pricingTier: 'DAILY' as const,
              });
            }
          }
        }

        // Create new items
        if (newOrderItems.length > 0) {
          await prisma.rentalOrderItem.createMany({
            data: newOrderItems,
          });
        }
      } else if (input.rentalStartDate || input.rentalEndDate) {
        // Dates changed but items not replaced — recalculate existing items
        const existingItems = await prisma.rentalOrderItem.findMany({
          where: { rentalOrderId: order.id },
        });

        subtotal = 0;
        for (const item of existingItems) {
          const newSubtotal =
            Number(item.unitPrice) * durationDays * item.quantity;
          subtotal += newSubtotal;
          await prisma.rentalOrderItem.update({
            where: { id: item.id },
            data: { subtotal: newSubtotal },
          });
        }
      }

      // 5. Calculate totals
      const discountAmount =
        input.discountAmount ?? Number(order.discountAmount || 0);
      const deliveryFee =
        input.deliveryFee ?? Number(order.deliveryFee || 0);
      const finalSubtotal = subtotal - discountAmount;
      totalAmount = finalSubtotal + deliveryFee;

      // 6. Build order update data
      const orderUpdate: Record<string, unknown> = {
        subtotal,
        totalAmount,
      };

      if (input.rentalStartDate)
        orderUpdate.rentalStartDate = input.rentalStartDate;
      if (input.rentalEndDate) {
        orderUpdate.rentalEndDate = input.rentalEndDate;
        orderUpdate.dueDateTime = input.rentalEndDate;
      }
      if (input.notes !== undefined) orderUpdate.notes = input.notes;
      if (input.deliveryFee !== undefined)
        orderUpdate.deliveryFee = input.deliveryFee;
      if (input.deliveryAddress !== undefined)
        orderUpdate.deliveryAddress = input.deliveryAddress;
      if (input.street !== undefined)
        orderUpdate.street = input.street;
      if (input.kelurahan !== undefined)
        orderUpdate.kelurahan = input.kelurahan;
      if (input.kecamatan !== undefined)
        orderUpdate.kecamatan = input.kecamatan;
      if (input.kota !== undefined) orderUpdate.kota = input.kota;
      if (input.provinsi !== undefined)
        orderUpdate.provinsi = input.provinsi;
      if (input.zip !== undefined) orderUpdate.zip = input.zip;
      if (input.latitude !== undefined)
        orderUpdate.latitude = input.latitude;
      if (input.longitude !== undefined)
        orderUpdate.longitude = input.longitude;
      if (input.paymentMethod !== undefined)
        orderUpdate.paymentMethod = input.paymentMethod;
      if (input.discountAmount !== undefined)
        orderUpdate.discountAmount = input.discountAmount;
      if (input.discountLabel !== undefined)
        orderUpdate.discountLabel = input.discountLabel;

      // 7. Update the order
      const updated = await prisma.rentalOrder.update({
        where: { id: order.id },
        data: orderUpdate,
        include: {
          partner: { select: { name: true, phone: true } },
          items: true,
        },
      });

      return {
        id: updated.id,
        orderNumber: updated.orderNumber,
        publicToken: updated.publicToken || updated.id,
        status: updated.status,
        totalAmount: Number(updated.totalAmount),
      };
    }),

  /**
   * Delete order by ID (Internal/Rollback Use)
   * Used by santi-living to rollback invalid orders
   */
  deleteOrder: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      // Find order first
      const order = await prisma.rentalOrder.findUnique({
        where: { id: input.id },
      });

      if (!order) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Order not found',
        });
      }

      // Check restricted deletion if necessary (e.g. only DRAFT)
      if (order.status !== RentalOrderStatus.DRAFT) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot delete order that is not DRAFT',
        });
      }

      // Manually delete items first to avoid foreign key constraint errors
      await prisma.rentalOrderItem.deleteMany({
        where: { rentalOrderId: input.id },
      });

      await prisma.rentalOrder.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});
