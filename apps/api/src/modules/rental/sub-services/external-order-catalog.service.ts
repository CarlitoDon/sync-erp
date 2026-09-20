import { prisma, Prisma } from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';
import { Decimal } from 'decimal.js';
import type {
  OrderItemComponent,
  ExternalOrderItemInput,
  ResolvedOrderItem,
  RateBearingRecord,
} from './external-order.types.js';

export class ExternalOrderCatalogService {
  async buildOrderItems(params: {
    companyId: string;
    items: ExternalOrderItemInput[];
    durationDays: number;
    allowAutoCreate: boolean;
  }): Promise<{
    subtotal: Decimal;
    orderItems: ResolvedOrderItem[];
  }> {
    let subtotal = new Decimal(0);
    const orderItems: ResolvedOrderItem[] = [];

    for (const item of params.items) {
      if (item.rentalBundleId) {
        const bundle = await this.resolveBundle(
          params.companyId,
          item,
          params.allowAutoCreate
        );
        const dailyRate = this.resolveInvoiceDailyRate(
          item,
          bundle.dailyRate
        );
        const itemTotal = this.resolveInvoiceLineTotal(
          item,
          dailyRate,
          params.durationDays
        );
        const unitPrice = this.resolveInvoiceUnitPrice(
          item,
          dailyRate,
          params.durationDays
        );

        subtotal = subtotal.plus(itemTotal);
        orderItems.push({
          rentalBundleId: bundle.id,
          quantity: item.quantity,
          unitPrice,
          subtotal: itemTotal,
          pricingTier:
            item.pricePerDay !== undefined ||
            item.lineTotal !== undefined
              ? 'CUSTOM'
              : 'DAILY',
        });
        continue;
      }

      if (item.rentalItemId) {
        const rentalItem = await this.resolveRentalItem(
          params.companyId,
          item,
          params.allowAutoCreate
        );
        const dailyRate = this.resolveInvoiceDailyRate(
          item,
          rentalItem.dailyRate
        );
        const itemTotal = this.resolveInvoiceLineTotal(
          item,
          dailyRate,
          params.durationDays
        );
        const unitPrice = this.resolveInvoiceUnitPrice(
          item,
          dailyRate,
          params.durationDays
        );

        subtotal = subtotal.plus(itemTotal);
        orderItems.push({
          rentalItemId: rentalItem.id,
          quantity: item.quantity,
          unitPrice,
          subtotal: itemTotal,
          pricingTier:
            item.pricePerDay !== undefined ||
            item.lineTotal !== undefined
              ? 'CUSTOM'
              : 'DAILY',
        });
        continue;
      }

      throw new DomainError(
        'Either rentalItemId or rentalBundleId is required',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    return { subtotal, orderItems };
  }

  resolveInvoiceDailyRate(
    item: ExternalOrderItemInput,
    fallbackDailyRate: Prisma.Decimal
  ): Decimal {
    if (item.pricePerDay === undefined) {
      return new Decimal(fallbackDailyRate);
    }

    if (item.pricePerDay <= 0) {
      throw new DomainError(
        'pricePerDay must be positive when provided',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    return new Decimal(item.pricePerDay);
  }

  resolveInvoiceLineTotal(
    item: ExternalOrderItemInput,
    dailyRate: Decimal,
    durationDays: number
  ): Decimal {
    if (item.lineTotal !== undefined) {
      return this.toMoney(item.lineTotal);
    }

    return this.toMoney(
      dailyRate.times(durationDays).times(item.quantity)
    );
  }

  resolveInvoiceUnitPrice(
    item: ExternalOrderItemInput,
    dailyRate: Decimal,
    durationDays: number
  ): Decimal {
    if (item.pricePerDay !== undefined) {
      return this.toMoney(item.pricePerDay);
    }

    if (item.lineTotal !== undefined) {
      return this.toMoney(
        new Decimal(item.lineTotal)
          .div(durationDays)
          .div(item.quantity)
      );
    }

    return this.toMoney(dailyRate);
  }

  toMoney(value: Prisma.Decimal | Decimal | number): Decimal {
    return new Decimal(value).toDecimalPlaces(2);
  }

  async resolveBundle(
    companyId: string,
    item: ExternalOrderItemInput,
    allowAutoCreate: boolean
  ): Promise<RateBearingRecord> {
    let bundle = await prisma.rentalBundle.findFirst({
      where: {
        companyId,
        OR: [
          { id: item.rentalBundleId },
          { externalId: item.rentalBundleId },
        ],
      },
      select: {
        id: true,
        dailyRate: true,
      },
    });

    if (
      !bundle &&
      allowAutoCreate &&
      item.name &&
      item.pricePerDay
    ) {
      bundle = await this.createBundleWithComponents(companyId, item);
    }

    if (!bundle) {
      throw new DomainError(
        `Bundle not found: ${item.rentalBundleId}. Provide name, pricePerDay, and components for auto-creation.`,
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    return bundle;
  }

  async createBundleWithComponents(
    companyId: string,
    item: ExternalOrderItemInput
  ): Promise<RateBearingRecord> {
    if (!item.rentalBundleId || !item.name || !item.pricePerDay) {
      throw new DomainError(
        'Bundle metadata is incomplete for auto-creation',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    const bundleExternalId = item.rentalBundleId;
    const bundleName = item.name;
    const bundlePricePerDay = item.pricePerDay;

    return prisma.$transaction(async (tx) => {
      const newBundle = await tx.rentalBundle.create({
        data: {
          companyId,
          externalId: bundleExternalId,
          name: bundleName,
          dailyRate: bundlePricePerDay,
          weeklyRate: bundlePricePerDay * 6,
          monthlyRate: bundlePricePerDay * 25,
          isActive: true,
        },
        select: {
          id: true,
          dailyRate: true,
        },
      });

      for (const component of item.components || []) {
        const normalized = this.normalizeComponentItem(component);
        const { quantity, label } = normalized;
        const rentalItem = await this.findOrCreateComponentRentalItem(
          tx,
          companyId,
          label
        );

        await tx.rentalBundleComponent.create({
          data: {
            bundleId: newBundle.id,
            rentalItemId: rentalItem.id,
            quantity,
            componentLabel: label,
          },
        });
      }

      return newBundle;
    });
  }

  async resolveRentalItem(
    companyId: string,
    item: ExternalOrderItemInput,
    allowAutoCreate: boolean
  ): Promise<RateBearingRecord> {
    let rentalItem = await prisma.rentalItem.findFirst({
      where: {
        companyId,
        id: item.rentalItemId,
      },
      select: {
        id: true,
        dailyRate: true,
      },
    });

    if (!rentalItem && item.rentalItemId) {
      rentalItem = await prisma.rentalItem.findFirst({
        where: {
          companyId,
          product: {
            name: {
              equals: item.rentalItemId,
              mode: 'insensitive',
            },
          },
        },
        select: {
          id: true,
          dailyRate: true,
        },
      });
    }

    if (!rentalItem && item.components?.[0]) {
      const firstComponent = this.getComponentLabel(item.components[0]);
      const componentSku = this.toExternalSku(firstComponent);
      const freshLookup = await prisma.rentalItem.findFirst({
        where: {
          companyId,
          OR: [
            { product: { sku: componentSku } },
            {
              product: {
                name: {
                  contains: firstComponent,
                  mode: 'insensitive',
                },
              },
            },
          ],
        },
        select: {
          id: true,
          dailyRate: true,
        },
      });

      if (freshLookup) {
        rentalItem = freshLookup;
      }
    }

    if (
      !rentalItem &&
      allowAutoCreate &&
      item.name &&
      item.pricePerDay
    ) {
      rentalItem = await this.findOrCreateRentalItem(companyId, item);
    }

    if (!rentalItem) {
      throw new DomainError(
        `Rental item not found for: ${item.rentalItemId}. Provide name and pricePerDay for auto-creation.`,
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    return rentalItem;
  }

  async findOrCreateRentalItem(
    companyId: string,
    item: ExternalOrderItemInput
  ): Promise<RateBearingRecord> {
    if (!item.rentalItemId || !item.name || !item.pricePerDay) {
      throw new DomainError(
        'Rental item metadata is incomplete for auto-creation',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    const componentName = item.components?.[0];
    const label = componentName ? this.getComponentLabel(componentName) : null;
    const productName = label
      ? this.capitalizeLabel(label)
      : item.name;
    const productSku = label
      ? this.toExternalSku(label)
      : this.toExternalSku(item.rentalItemId);

    let product = await prisma.product.findFirst({
      where: {
        companyId,
        sku: productSku,
      },
      select: {
        id: true,
      },
    });

    if (!product) {
      product = await prisma.product.create({
        data: {
          companyId,
          sku: productSku,
          name: productName,
          price: 0,
        },
        select: {
          id: true,
        },
      });
    }

    const existingRentalItem = await prisma.rentalItem.findFirst({
      where: {
        companyId,
        productId: product.id,
      },
      select: {
        id: true,
        dailyRate: true,
      },
    });

    if (existingRentalItem) {
      return existingRentalItem;
    }

    return prisma.rentalItem.create({
      data: {
        companyId,
        productId: product.id,
        dailyRate: item.pricePerDay,
        weeklyRate: item.pricePerDay * 6,
        monthlyRate: item.pricePerDay * 25,
        depositPolicyType: 'PERCENTAGE',
        depositPercentage: 0,
        isActive: true,
      },
      select: {
        id: true,
        dailyRate: true,
      },
    });
  }

  async findOrCreateComponentRentalItem(
    tx: Prisma.TransactionClient,
    companyId: string,
    label: string
  ): Promise<{ id: string }> {
    const existing = await tx.rentalItem.findFirst({
      where: {
        companyId,
        product: {
          name: {
            contains: label,
            mode: 'insensitive',
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      return existing;
    }

    const product = await tx.product.create({
      data: {
        companyId,
        sku: this.toExternalSku(label),
        name: this.capitalizeLabel(label),
        price: 0,
      },
      select: {
        id: true,
      },
    });

    return tx.rentalItem.create({
      data: {
        companyId,
        productId: product.id,
        dailyRate: 5000,
        weeklyRate: 30000,
        monthlyRate: 125000,
        depositPolicyType: 'PERCENTAGE',
        depositPercentage: 0,
        isActive: true,
      },
      select: {
        id: true,
      },
    });
  }

  parseComponentLabel(componentLabel: string) {
    const quantityMatch = componentLabel.match(/^(\d+)\s+(.+)$/);

    return {
      quantity: quantityMatch
        ? parseInt(quantityMatch[1], 10)
        : 1,
      label: quantityMatch ? quantityMatch[2] : componentLabel,
    };
  }

  getComponentLabel(component: string | OrderItemComponent): string {
    return typeof component === 'string' ? component : component.label;
  }

  normalizeComponentItem(
    component: string | OrderItemComponent
  ): { quantity: number; label: string } {
    if (typeof component === 'string') {
      return this.parseComponentLabel(component);
    }
    return component;
  }

  toExternalSku(value: string): string {
    return `EXT-${value.toLowerCase().replace(/\s+/g, '-')}`;
  }

  capitalizeLabel(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
