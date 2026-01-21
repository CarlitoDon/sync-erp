import { router, publicProcedure, apiKeyProcedure } from '../trpc';
import { z } from 'zod';
import { Prisma } from '@sync-erp/database';
import { Decimal } from 'decimal.js';
import {
  prisma,
  PartnerType,
  RentalOrderStatus,
  RentalPaymentStatus,
  OrderSource,
  // Prisma, // Removed
} from '@sync-erp/database';
import { TRPCError } from '@trpc/server';
import { container, ServiceKeys } from '../../modules/common/di';
import type { RentalWebhookService } from '../../modules/rental/rental-webhook.service';

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

// Multi-tenant webhook service (for tenant-specific notifications)
import { webhookService as tenantWebhookService } from '../../services/webhook.service';

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
   * Find or create partner by phone
   * Used when creating orders from santi-living
   */
  findOrCreatePartner: apiKeyProcedure
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
        // NOTE: Removed early auto-create here - the main loop (line 480+)
        // handles auto-creation with proper component SKU matching
      }

      // NOTE: rentalItemsFull lookup removed - we now use fresh queries inside the loop

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

  /**
   * Confirm payment - called when customer clicks "I've paid"
   * Updates order payment status to AWAITING_CONFIRM
   */
  confirmPayment: apiKeyProcedure
    .input(
      z.object({
        token: z.string().uuid(),
        paymentMethod: z.enum(['qris', 'transfer']),
        reference: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Find order by token
      const order = await prisma.rentalOrder.findFirst({
        where: { publicToken: input.token },
        select: {
          id: true,
          orderNumber: true,
          rentalPaymentStatus: true,
          status: true,
          companyId: true,
          totalAmount: true,
        },
      });

      if (!order) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Order not found',
        });
      }

      // Validate current status - only PENDING can transition to AWAITING_CONFIRM
      if (order.rentalPaymentStatus !== RentalPaymentStatus.PENDING) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot confirm payment. Current status: ${order.rentalPaymentStatus}`,
        });
      }

      // Update payment status
      const updatedOrder = await prisma.rentalOrder.update({
        where: { id: order.id },
        data: {
          rentalPaymentStatus: RentalPaymentStatus.AWAITING_CONFIRM,
          paymentClaimedAt: new Date(),
          paymentMethod: input.paymentMethod,
          paymentReference: input.reference || null,
        },
        select: {
          orderNumber: true,
          rentalPaymentStatus: true,
          paymentClaimedAt: true,
          paymentMethod: true,
          paymentReference: true,
        },
      });

      // Fire webhook notification to admin (async, non-blocking)
      const webhookService = getWebhookService();
      if (webhookService) {
        webhookService
          .notifyPaymentStatus({
            token: input.token,
            action: 'claimed',
            paymentMethod: input.paymentMethod,
          })
          .catch((err) => {
            console.error(
              '[PublicRental] Payment claimed webhook failed:',
              err
            );
          });
      }

      // Fire multi-tenant webhook (async, non-blocking)
      tenantWebhookService
        .notifyPaymentEvent(ctx.companyId, 'payment.received', {
          id: order.id,
          orderNumber: order.orderNumber || '',
          rentalPaymentStatus: 'AWAITING_CONFIRM',
          totalAmount: order.totalAmount,
          paymentMethod: input.paymentMethod,
          paymentReference: input.reference || null,
        })
        .catch((err) => {
          console.error(
            '[PublicRental] Tenant payment webhook failed:',
            err
          );
        });

      return {
        success: true,
        orderNumber: updatedOrder.orderNumber,
        rentalPaymentStatus: updatedOrder.rentalPaymentStatus,
        paymentClaimedAt: updatedOrder.paymentClaimedAt,
      };
    }),

  /**
   * Confirm payment by Order Number (Internal/Webhook Use)
   * Used by Midtrans webhook to confirm payment via Order Number
   */
  confirmPaymentByOrderNumber: publicProcedure
    .input(
      z.object({
        orderNumber: z.string(),
        paymentMethod: z.string(),
        transactionId: z.string().optional(),
        amount: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Find order by order number
      const order = await prisma.rentalOrder.findFirst({
        where: { orderNumber: input.orderNumber },
      });

      if (!order) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Order not found',
        });
      }

      // If already confirmed, ignore (idempotency)
      if (
        order.rentalPaymentStatus === RentalPaymentStatus.CONFIRMED
      ) {
        return { success: true, status: 'ALREADY_CONFIRMED' };
      }

      // Update payment status to CONFIRMED (Trusted from Midtrans)
      // We also auto-confirm status to CONFIRMED (ready for unit assignment)
      const updatedOrder = await prisma.rentalOrder.update({
        where: { id: order.id },
        data: {
          rentalPaymentStatus: RentalPaymentStatus.CONFIRMED,
          paymentConfirmedAt: new Date(),

          paymentMethod: input.paymentMethod,
          paymentReference: input.transactionId,
          // DO NOT auto-confirm status. Keeping it DRAFT allows Admin to assign unit before confirming.
          // status: RentalOrderStatus.CONFIRMED, (REMOVED)
        },
      });

      // Fire webhook notification to admin & customer (async, non-blocking)
      const webhookService = getWebhookService();
      if (webhookService && order.publicToken) {
        webhookService
          .notifyPaymentStatus({
            token: order.publicToken,
            action: 'confirmed',
            paymentMethod: input.paymentMethod,
            paymentReference: input.transactionId,
          })
          .catch((err) => {
            console.error(
              '[PublicRental] Payment confirmed webhook failed:',
              err
            );
          });
      }

      return {
        success: true,
        orderNumber: updatedOrder.orderNumber,
        status: updatedOrder.status,
      };
    }),
});

export type PublicRentalRouter = typeof publicRentalRouter;
