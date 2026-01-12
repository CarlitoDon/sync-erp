import { router, publicProcedure } from '../trpc';
import { z } from 'zod';
import {
  prisma,
  PartnerType,
  RentalOrderStatus,
  OrderSource,
  Prisma,
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
   * Auto-creates bundles/items if not found (for santi-living integration)
   */
  createOrder: publicProcedure
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

        // If still not found, auto-create rental items for santi-living
        if (rentalItemsByName.length === 0) {
          // Create products and rental items on the fly for santi-living orders
          const createdItems = [];
          for (const item of itemsWithRentalItemId) {
            // Create product
            const product = await prisma.product.create({
              data: {
                companyId: input.companyId,
                sku: `SL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name: item.rentalItemId,
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

      // Fetch all rental items with product info for SKU-based lookup
      // This is used to find existing kasur items by component SKU (e.g., "SL-kasur-busa-180x200")
      const rentalItemsFull = await prisma.rentalItem.findMany({
        where: { companyId: input.companyId },
        include: { product: true },
      });

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
            console.log(
              `[Auto-Create] Creating bundle: ${item.rentalBundleId} - ${item.name}`
            );
            
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
                console.log(
                  `[Auto-Create] Creating ${item.components.length} bundle components: ${item.components.join(', ')}`
                );

                for (const componentLabel of item.components) {
                  // Parse quantity from label (e.g., "2 bantal" -> quantity: 2, label: "bantal")
                  const quantityMatch = componentLabel.match(/^(\d+)\s+(.+)$/);
                  const quantity = quantityMatch ? parseInt(quantityMatch[1], 10) : 1;
                  const label = quantityMatch ? quantityMatch[2] : componentLabel;

                  // Find or create the rental item for this component
                  let rentalItem = await tx.rentalItem.findFirst({
                    where: {
                      companyId: input.companyId,
                      product: {
                        name: { contains: label, mode: 'insensitive' },
                      },
                    },
                  });

                  // If not found, create product and rental item
                  if (!rentalItem) {
                    const product = await tx.product.create({
                      data: {
                        companyId: input.companyId,
                        sku: `SL-${label.toLowerCase().replace(/\s+/g, '-')}`,
                        name: label.charAt(0).toUpperCase() + label.slice(1),
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
          let rentalItem: { id: string; dailyRate: Prisma.Decimal } | undefined = rentalItems.find(
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
          if (!rentalItem && item.components?.[0]) {
            const componentSku = `SL-${item.components[0].toLowerCase().replace(/\s+/g, '-')}`;
            rentalItem = rentalItemsFull.find(
              (r) => r.product?.sku?.toLowerCase() === componentSku.toLowerCase()
            );
            if (rentalItem) {
              console.log(
                `[Lookup] Found existing rental item by component SKU: ${componentSku}`
              );
            }
          }

          // Auto-create rental item if not found and metadata provided
          if (!rentalItem && item.name && item.pricePerDay) {
            // For mattress-only items, use components[0] (e.g., "kasur busa 180x200")
            // so it matches the kasur component from packages
            const componentName = item.components?.[0];
            const productName = componentName
              ? componentName.charAt(0).toUpperCase() + componentName.slice(1)
              : item.name;
            const productSku = componentName
              ? `SL-${componentName.toLowerCase().replace(/\s+/g, '-')}`
              : `SL-${item.rentalItemId}`;

            console.log(
              `[Auto-Create] Creating rental item: ${item.rentalItemId} - ${productName} (sku: ${productSku})`
            );

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
            const existingRentalItem = await prisma.rentalItem.findFirst({
              where: {
                companyId: input.companyId,
                productId: product.id,
              },
            });

            if (existingRentalItem) {
              rentalItem = existingRentalItem;
              console.log(
                `[Auto-Create] Found existing rental item for product: ${productName}`
              );
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
          orderSource: OrderSource.WEBSITE,

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
