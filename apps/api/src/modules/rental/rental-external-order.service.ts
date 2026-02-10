import {
  prisma,
  RentalOrderStatus,
  RentalPaymentStatus,
  OrderSource,
  Prisma,
} from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';
import { Decimal } from 'decimal.js';
import { container, ServiceKeys } from '../common/di';
import type { RentalWebhookService } from './rental-webhook.service';

// Lazy resolve webhook service
const getWebhookService = (): RentalWebhookService | null => {
  try {
    return container.resolve<RentalWebhookService>(
      ServiceKeys.RENTAL_WEBHOOK_SERVICE
    );
  } catch {
    return null;
  }
};

export interface CreatePublicOrderInput {
  companyId: string;
  partnerId: string;
  rentalStartDate: Date;
  rentalEndDate: Date;
  items: {
    rentalItemId?: string;
    rentalBundleId?: string;
    quantity: number;
    name?: string;
    pricePerDay?: number;
    category?: 'package' | 'mattress' | 'accessory';
    components?: string[];
  }[];
  notes?: string;
  deliveryFee?: number;
  deliveryAddress?: string;
  street?: string;
  kelurahan?: string;
  kecamatan?: string;
  kota?: string;
  provinsi?: string;
  zip?: string;
  latitude?: number;
  longitude?: number;
  paymentMethod?: string;
  discountAmount?: number;
  discountLabel?: string;
}

export interface UpdatePublicOrderInput {
  token: string;
  customerName?: string;
  customerPhone?: string;
  rentalStartDate?: Date;
  rentalEndDate?: Date;
  notes?: string;
  deliveryFee?: number;
  deliveryAddress?: string;
  street?: string;
  kelurahan?: string;
  kecamatan?: string;
  kota?: string;
  provinsi?: string;
  zip?: string;
  latitude?: number;
  longitude?: number;
  paymentMethod?: string;
  discountAmount?: number;
  discountLabel?: string;
  items?: {
    rentalItemId?: string;
    rentalBundleId?: string;
    quantity: number;
    name?: string;
    pricePerDay?: number;
    category?: 'package' | 'mattress' | 'accessory';
    components?: string[];
  }[];
}

export class RentalExternalOrderService {
  async getByToken(token: string) {
    const order = await prisma.rentalOrder.findFirst({
      where: { publicToken: token },
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
      throw new DomainError(
        'Order not found',
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }

    return order;
  }

  async createOrder(input: CreatePublicOrderInput) {
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

      if (rentalItemsByName.length > 0) {
        rentalItems = rentalItemsByName;
      }
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
          throw new DomainError(
            `Bundle not found: ${item.rentalBundleId}. Provide name, pricePerDay, and components for auto-creation.`,
            400,
            DomainErrorCodes.INVALID_INPUT
          );
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
              rentalItem = {
                ...freshLookup,
                dailyRate: new Decimal(item.pricePerDay),
              };
            }
          }
        }

        // Auto-create rental item if not found and metadata provided
        if (!rentalItem && item.name && item.pricePerDay) {
          const componentName = item.components?.[0];
          const productName = componentName
            ? componentName.charAt(0).toUpperCase() +
              componentName.slice(1)
            : item.name;
          const productSku = componentName
            ? `SL-${componentName.toLowerCase().replace(/\s+/g, '-')}`
            : `SL-${item.rentalItemId}`;

          let product = await prisma.product.findFirst({
            where: {
              companyId: input.companyId,
              sku: productSku,
            },
          });

          if (!product) {
            product = await prisma.product.create({
              data: {
                companyId: input.companyId,
                sku: productSku,
                name: productName,
                price: 0,
              },
            });
          }

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
          throw new DomainError(
            `Rental item not found for: ${item.rentalItemId}. Provide name and pricePerDay for auto-creation.`,
            400,
            DomainErrorCodes.INVALID_INPUT
          );
        }

        const itemTotal =
          Number(rentalItem.dailyRate) * durationDays * item.quantity;
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

    // Create order
    const order = await prisma.rentalOrder.create({
      data: {
        companyId: input.companyId,
        partnerId: input.partnerId,
        orderNumber,
        rentalStartDate: input.rentalStartDate,
        rentalEndDate: input.rentalEndDate,
        dueDateTime: input.rentalEndDate,
        publicToken: crypto.randomUUID(),
        status: RentalOrderStatus.DRAFT,
        rentalPaymentStatus: RentalPaymentStatus.PENDING,
        subtotal,
        depositAmount: 0,
        totalAmount,
        policySnapshot: {},
        notes: input.notes,
        createdBy: 'santi-living-website',

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

    // Fire webhook
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

        // Rollback
        try {
          await prisma.rentalOrderItem.deleteMany({
            where: { rentalOrderId: order.id },
          });
          await prisma.rentalOrder.delete({
            where: { id: order.id },
          });
        } catch (rollbackErr) {
          console.warn(
            '[PublicRental] Rollback failed (likely already deleted):',
            rollbackErr
          );
        }

        throw new DomainError(
          errorMessage ||
            'Gagal validasi pesanan (WhatsApp tidak valid)',
          400,
          DomainErrorCodes.INVALID_INPUT
        );
      }
    }

    return order;
  }

  async updateOrder(input: UpdatePublicOrderInput) {
    const order = await prisma.rentalOrder.findFirst({
      where: { publicToken: input.token },
      include: { partner: true, items: true },
    });

    if (!order) {
      throw new DomainError(
        'Order not found',
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }

    if (order.status !== RentalOrderStatus.DRAFT) {
      throw new DomainError(
        'Only draft orders can be updated',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }

    if (
      order.rentalPaymentStatus &&
      order.rentalPaymentStatus !== RentalPaymentStatus.PENDING
    ) {
      throw new DomainError(
        'Cannot update order with active payment',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }

    // Update partner info
    if (input.customerName || input.customerPhone) {
      const partnerUpdate: Record<string, unknown> = {};
      if (input.customerName) partnerUpdate.name = input.customerName;
      if (input.customerPhone)
        partnerUpdate.phone = input.customerPhone;

      // Update partner address fields if provided in order update
      if (input.deliveryAddress)
        partnerUpdate.address = input.deliveryAddress;
      if (input.street) partnerUpdate.street = input.street;
      if (input.kelurahan) partnerUpdate.kelurahan = input.kelurahan;
      if (input.kecamatan) partnerUpdate.kecamatan = input.kecamatan;
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

    // Recalculate items
    const startDate = input.rentalStartDate || order.rentalStartDate;
    const endDate = input.rentalEndDate || order.rentalEndDate;
    const durationDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    let subtotal = Number(order.subtotal);
    let totalAmount = Number(order.totalAmount);

    if (input.items && input.items.length > 0) {
      await prisma.rentalOrderItem.deleteMany({
        where: { rentalOrderId: order.id },
      });

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
              Number(bundle.dailyRate) * durationDays * item.quantity;
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
          // Logic similar to createOrder (omitted slight duplications for brevity, assuming standard lookup)
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

          // Fallback lookup by component SKU if not found
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

      if (newOrderItems.length > 0) {
        await prisma.rentalOrderItem.createMany({
          data: newOrderItems,
        });
      }
    } else if (input.rentalStartDate || input.rentalEndDate) {
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

    const discountAmount =
      input.discountAmount ?? Number(order.discountAmount || 0);
    const deliveryFee =
      input.deliveryFee ?? Number(order.deliveryFee || 0);
    const finalSubtotal = subtotal - discountAmount;
    totalAmount = finalSubtotal + deliveryFee;

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
    // ... Copy other fields
    if (input.deliveryFee !== undefined)
      orderUpdate.deliveryFee = input.deliveryFee;
    if (input.deliveryAddress !== undefined)
      orderUpdate.deliveryAddress = input.deliveryAddress;
    if (input.street !== undefined) orderUpdate.street = input.street;
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

    const updated = await prisma.rentalOrder.update({
      where: { id: order.id },
      data: orderUpdate,
      include: {
        partner: { select: { name: true, phone: true } },
        items: true,
      },
    });

    return updated;
  }

  async deleteOrder(id: string) {
    // Find order first
    const order = await prisma.rentalOrder.findUnique({
      where: { id },
    });

    if (!order) {
      throw new DomainError(
        'Order not found',
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }

    // Check restricted deletion if necessary (e.g. only DRAFT)
    if (order.status !== RentalOrderStatus.DRAFT) {
      throw new DomainError(
        'Cannot delete order that is not DRAFT',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }

    // Manually delete items first to avoid foreign key constraint errors
    await prisma.rentalOrderItem.deleteMany({
      where: { rentalOrderId: id },
    });

    await prisma.rentalOrder.delete({
      where: { id },
    });

    return { success: true };
  }
}
