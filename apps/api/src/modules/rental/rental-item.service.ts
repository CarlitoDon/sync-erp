/**
 * Rental Item Service
 *
 * Handles rental item and unit management operations.
 * Extracted from rental.service.ts for better maintainability.
 */

import { Prisma, prisma } from '@sync-erp/database';
import {
  RentalItem,
  RentalItemUnit,
  InvoiceType,
  OrderType,
  UnitStatus,
  UnitCondition,
  RentalOrderStatus,
  DepositPolicyType,
  EntityType,
  AuditLogAction,
} from '@sync-erp/database';
import { RentalRepository } from './rental.repository';
import { RentalPolicy as Policy } from './rental.policy';
import { recordAudit } from '../common/audit/audit-log.service';
import {
  DomainError,
  DomainErrorCodes,
  type CreateRentalItemInput,
  type ConvertStockToUnitInput,
  type RentalItemWithRelations,
} from '@sync-erp/shared';
import { Decimal } from 'decimal.js';
import { mapToRentalItem } from './rental.mapper';

/**
 * Generate a unique unit code with format: [SKU_PREFIX]-[RANDOM_6_CHAR]
 * Example: KASUR90-A7X9K2
 */
function generateUniqueUnitCode(productSku: string): string {
  const prefix = productSku
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 8)
    .toUpperCase();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No O,0,1,I to avoid confusion
  let random = '';
  for (let i = 0; i < 6; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${random}`;
}

function inferSizeLabel(value: string): string | undefined {
  const compact = value.replace(/\s+/g, ' ');
  const cmMatch = compact.match(/\b(\d{2,3})\s*cm\b/i);
  if (cmMatch) return `${cmMatch[1]}cm`;

  const sizeMatch = compact.match(/\b(\d{2,3})\s*[xX]\s*(\d{3})\b/);
  if (sizeMatch) return `${sizeMatch[1]}x${sizeMatch[2]}`;

  return undefined;
}

function inferColor(value: string): string | undefined {
  const normalized = value.toLowerCase();
  const colors = [
    'biru',
    'merah',
    'putih',
    'hitam',
    'abu',
    'coklat',
    'hijau',
    'kuning',
    'pink',
    'ungu',
  ];
  return colors.find((color) => normalized.includes(color));
}

export class RentalItemService {
  constructor(
    private readonly repository: RentalRepository = new RentalRepository()
  ) {}

  async listItems(
    companyId: string,
    filters?: { isActive?: boolean }
  ): Promise<RentalItemWithRelations[]> {
    const items = await this.repository.listRentalItems(
      companyId,
      filters?.isActive
    );
    return items.map(mapToRentalItem);
  }

  async createItem(
    companyId: string,
    data: CreateRentalItemInput,
    userId: string
  ): Promise<RentalItem> {
    // Validate pricing tiers
    if (data.weeklyRate >= data.dailyRate * 7) {
      throw new DomainError(
        'Weekly rate must be less than 7x daily rate for economic incentive',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }
    if (data.monthlyRate >= data.dailyRate * 30) {
      throw new DomainError(
        'Monthly rate must be less than 30x daily rate for economic incentive',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    // Validate deposit policy requirements
    if (data.depositPolicyType === DepositPolicyType.PERCENTAGE) {
      if (!data.depositPercentage) {
        throw new DomainError(
          'depositPercentage required for PERCENTAGE policy',
          400,
          DomainErrorCodes.INVALID_INPUT
        );
      }
    } else if (
      data.depositPolicyType === DepositPolicyType.PER_UNIT
    ) {
      if (!data.depositPerUnit) {
        throw new DomainError(
          'depositPerUnit required for PER_UNIT policy',
          400,
          DomainErrorCodes.INVALID_INPUT
        );
      }
    } else if (data.depositPolicyType === DepositPolicyType.HYBRID) {
      if (!data.depositPercentage || !data.depositPerUnit) {
        throw new DomainError(
          'Both depositPercentage and depositPerUnit required for HYBRID policy',
          400,
          DomainErrorCodes.INVALID_INPUT
        );
      }
    }

    // Validate product exists and belongs to company
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    });
    if (!product || product.companyId !== companyId) {
      throw new DomainError(
        'Product not found or does not belong to this company',
        404,
        DomainErrorCodes.ORDER_NOT_FOUND
      );
    }

    // Check if rental item already exists for this product
    const existingRentalItem = await prisma.rentalItem.findUnique({
      where: { productId: data.productId },
    });
    if (existingRentalItem) {
      throw new DomainError(
        'Rental item already exists for this product',
        409,
        DomainErrorCodes.ALREADY_EXISTS
      );
    }

    const item = await this.repository.createRentalItem({
      depositPercentage: data.depositPercentage
        ? new Decimal(data.depositPercentage)
        : null,
      depositPerUnit: data.depositPerUnit
        ? new Decimal(data.depositPerUnit)
        : null,
      depositPolicyType: data.depositPolicyType,
      dailyRate: new Decimal(data.dailyRate),
      weeklyRate: new Decimal(data.weeklyRate),
      monthlyRate: new Decimal(data.monthlyRate),
      company: { connect: { id: companyId } },
      product: { connect: { id: data.productId } },
    });

    await recordAudit({
      companyId,
      actorId: userId,
      action: AuditLogAction.RENTAL_ITEM_CREATED,
      entityType: EntityType.RENTAL_ITEM,
      entityId: item.id,
      businessDate: new Date(),
    });

    return item;
  }

  async convertStockToUnits(
    companyId: string,
    itemId: string,
    quantity: number,
    userId: string,
    options?: Omit<ConvertStockToUnitInput, 'rentalItemId' | 'quantity'>
  ): Promise<number> {
    const item = await this.repository.findRentalItemById(itemId);
    if (!item || item.companyId !== companyId) {
      throw new DomainError('Rental item not found', 404);
    }

    // 1. Check stock availability
    const productService = new (
      await import('../product/product.service')
    ).ProductService();
    const product = await productService.getById(
      item.productId,
      companyId
    );

    if (!product) throw new DomainError('Product not found', 404);

    if (product.stockQty < quantity) {
      throw new DomainError(
        `Insufficient stock. Available: ${product.stockQty}, Required: ${quantity}`,
        400,
        DomainErrorCodes.INSUFFICIENT_STOCK
      );
    }

    // 2. Execute Transaction: Move Stock OUT + Create Units with auto-generated codes
    const createdCodes: string[] = [];
    const count = await prisma.$transaction(async (tx) => {
      const sourceOrder = options?.sourceOrderId
        ? await tx.order.findFirst({
            where: {
              id: options.sourceOrderId,
              companyId,
              type: OrderType.PURCHASE,
            },
            include: { items: true },
          })
        : null;
      if (options?.sourceOrderId && !sourceOrder) {
        throw new DomainError(
          'Source purchase order not found',
          404,
          DomainErrorCodes.ORDER_NOT_FOUND
        );
      }

      let sourceOrderItemId = options?.sourceOrderItemId;
      if (sourceOrderItemId) {
        const sourceOrderItem = await tx.orderItem.findFirst({
          where: {
            id: sourceOrderItemId,
            productId: product.id,
            ...(options?.sourceOrderId && { orderId: options.sourceOrderId }),
            order: { companyId },
          },
          select: { id: true },
        });
        if (!sourceOrderItem) {
          throw new DomainError(
            'Source order item not found for this product',
            404,
            DomainErrorCodes.ORDER_NOT_FOUND
          );
        }
      } else if (sourceOrder) {
        sourceOrderItemId =
          sourceOrder.items.find((orderItem) => orderItem.productId === product.id)
            ?.id ?? undefined;
      }

      if (options?.sourceFulfillmentId) {
        const sourceFulfillment = await tx.fulfillment.findFirst({
          where: { id: options.sourceFulfillmentId, companyId },
          select: { id: true, orderId: true },
        });
        if (!sourceFulfillment) {
          throw new DomainError(
            'Source goods receipt not found',
            404,
            DomainErrorCodes.FULFILLMENT_NOT_FOUND
          );
        }
        if (
          options.sourceOrderId &&
          sourceFulfillment.orderId !== options.sourceOrderId
        ) {
          throw new DomainError(
            'Source goods receipt does not belong to source order',
            400,
            DomainErrorCodes.FULFILLMENT_NOT_FOR_ORDER
          );
        }
      }

      if (options?.sourceBillId) {
        const sourceBill = await tx.invoice.findFirst({
          where: { id: options.sourceBillId, companyId, type: InvoiceType.BILL },
          select: { id: true, orderId: true },
        });
        if (!sourceBill) {
          throw new DomainError(
            'Source bill not found',
            404,
            DomainErrorCodes.BILL_NOT_FOUND
          );
        }
        if (
          options.sourceOrderId &&
          sourceBill.orderId !== options.sourceOrderId
        ) {
          throw new DomainError(
            'Source bill does not belong to source order',
            400,
            DomainErrorCodes.BILL_INVALID_STATE
          );
        }
      }

      const inferredSizeLabel = inferSizeLabel(
        `${product.name} ${product.sku}`
      );
      const inferredColor = inferColor(`${product.name} ${product.sku}`);

      // Generate unique unit codes with retry
      const unitsToCreate: Prisma.RentalItemUnitCreateManyInput[] =
        [];

      for (let i = 0; i < quantity; i++) {
        const metadata = options?.unitMetadata?.[i];
        let unitCode = options?.unitCodes?.[i] ?? metadata?.unitCode ?? '';
        let attempts = 0;
        const maxAttempts = 10;

        // Retry loop to ensure uniqueness
        do {
          unitCode = unitCode || generateUniqueUnitCode(product.sku);
          const exists = await tx.rentalItemUnit.findUnique({
            where: { companyId_unitCode: { companyId, unitCode } },
          });
          if (!exists) break;
          if (options?.unitCodes?.[i] || metadata?.unitCode) {
            throw new DomainError(
              `Rental unit code already exists: ${unitCode}`,
              409,
              DomainErrorCodes.ALREADY_EXISTS
            );
          }
          unitCode = '';
          attempts++;
        } while (attempts < maxAttempts);

        if (attempts >= maxAttempts) {
          throw new DomainError(
            'Failed to generate unique unit code. Please try again.',
            500,
            DomainErrorCodes.ALREADY_EXISTS
          );
        }

        createdCodes.push(unitCode);
        unitsToCreate.push({
          rentalItemId: itemId,
          companyId,
          unitCode,
          acquiredAt:
            metadata?.acquiredAt ?? sourceOrder?.date ?? new Date(),
          acquisitionCost:
            metadata?.acquisitionCost ?? Number(product.averageCost),
          sourceOrderId: options?.sourceOrderId,
          sourceOrderItemId,
          sourceFulfillmentId: options?.sourceFulfillmentId,
          sourceBillId: options?.sourceBillId,
          sourceBatchCode: options?.sourceBatchCode,
          sizeLabel: metadata?.sizeLabel ?? inferredSizeLabel,
          color: metadata?.color ?? inferredColor,
          sourceNotes: metadata?.sourceNotes,
          condition: UnitCondition.NEW,
          status: UnitStatus.AVAILABLE,
        });
      }

      // Decrease Stock
      const invService = new (
        await import('../inventory/inventory.service')
      ).InventoryService();
      await invService.adjustStock(
        companyId,
        {
          productId: item.productId,
          quantity: -quantity,
          costPerUnit: Number(product.averageCost),
          reference: `Capitalization to Rental Units`,
        },
        undefined,
        undefined,
        tx
      );

      // Create Units
      const result = await tx.rentalItemUnit.createMany({
        data: unitsToCreate,
      });

      return result.count;
    });

    await recordAudit({
      companyId,
      actorId: userId,
      action: AuditLogAction.RENTAL_UNIT_ADDED,
      entityType: EntityType.RENTAL_ITEM_UNIT,
      entityId: itemId,
      businessDate: new Date(),
      payloadSnapshot: {
        source: 'INVENTORY_STOCK',
        quantity,
        unitCodes: createdCodes,
        sourceOrderId: options?.sourceOrderId,
        sourceOrderItemId: options?.sourceOrderItemId,
        sourceFulfillmentId: options?.sourceFulfillmentId,
        sourceBillId: options?.sourceBillId,
        sourceBatchCode: options?.sourceBatchCode,
      },
    });

    return count;
  }

  async updateUnitStatus(
    companyId: string,
    unitId: string,
    status: UnitStatus,
    reason?: string,
    userId?: string
  ): Promise<RentalItemUnit> {
    const unit = await this.repository.findRentalItemUnitById(unitId);
    if (!unit || unit.companyId !== companyId) {
      throw new DomainError(
        'Unit not found',
        404,
        DomainErrorCodes.ORDER_NOT_FOUND
      );
    }

    // Validate state transition (basic - can be expanded)
    Policy.validateUnitStatusTransition(unit.status, status);

    const updated = await this.repository.updateRentalItemUnit(
      unitId,
      {
        status,
        ...(status === UnitStatus.RETIRED && {
          retiredAt: new Date(),
          retirementReason: reason || 'Manual retirement',
        }),
      }
    );

    if (userId) {
      await recordAudit({
        companyId,
        actorId: userId,
        action: AuditLogAction.RENTAL_UNIT_ADDED,
        entityType: EntityType.RENTAL_ITEM_UNIT,
        entityId: unitId,
        businessDate: new Date(),
      });
    }

    return updated;
  }

  async checkAvailability(
    companyId: string,
    startDate: Date,
    endDate: Date,
    itemId?: string
  ): Promise<Record<string, number>> {
    const whereClause: Prisma.RentalItemUnitWhereInput = {
      companyId,
      status: { notIn: [UnitStatus.MAINTENANCE, UnitStatus.RETIRED] },
      ...(itemId && { rentalItemId: itemId }),
    };

    const availability: Record<string, number> = {};

    const counts = await prisma.rentalItemUnit.groupBy({
      by: ['rentalItemId'],
      where: whereClause,
      _count: {
        rentalItemId: true,
      },
    });

    for (const group of counts) {
      availability[group.rentalItemId] = group._count.rentalItemId;
    }

    const overlappingAssignments =
      await prisma.rentalOrderUnitAssignment.findMany({
        where: {
          rentalOrder: {
            companyId,
            status: {
              in: [
                RentalOrderStatus.CONFIRMED,
                RentalOrderStatus.ACTIVE,
              ],
            },
            rentalStartDate: { lt: endDate },
            rentalEndDate: { gt: startDate },
          },
          rentalItemUnit: {
            companyId,
            ...(itemId && { rentalItemId: itemId }),
          },
        },
        include: {
          rentalItemUnit: {
            select: { rentalItemId: true },
          },
        },
      });

    for (const assignment of overlappingAssignments) {
      const rentalItemId = assignment.rentalItemUnit.rentalItemId;
      availability[rentalItemId] = Math.max(
        0,
        (availability[rentalItemId] ?? 0) - 1
      );
    }

    return availability;
  }

  async getUnitsByItem(
    companyId: string,
    itemId: string,
    status?: UnitStatus
  ): Promise<RentalItemUnit[]> {
    return prisma.rentalItemUnit.findMany({
      where: {
        companyId,
        rentalItemId: itemId,
        ...(status && { status }),
      },
      orderBy: { unitCode: 'asc' },
    });
  }
}
