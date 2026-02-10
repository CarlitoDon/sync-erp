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
  UnitStatus,
  UnitCondition,
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
  type RentalItemWithRelations,
} from '@sync-erp/shared';
import { Decimal } from 'decimal.js';

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

export class RentalItemService {
  constructor(
    private readonly repository: RentalRepository = new RentalRepository()
  ) {}

  async listItems(
    companyId: string,
    filters?: { isActive?: boolean }
  ): Promise<RentalItemWithRelations[]> {
    return this.repository.listRentalItems(
      companyId,
      filters?.isActive
    ) as unknown as RentalItemWithRelations[];
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
    userId: string
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
      // Generate unique unit codes with retry
      const unitsToCreate: Prisma.RentalItemUnitCreateManyInput[] =
        [];

      for (let i = 0; i < quantity; i++) {
        let unitCode: string;
        let attempts = 0;
        const maxAttempts = 10;

        // Retry loop to ensure uniqueness
        do {
          unitCode = generateUniqueUnitCode(product.sku);
          const exists = await tx.rentalItemUnit.findUnique({
            where: { companyId_unitCode: { companyId, unitCode } },
          });
          if (!exists) break;
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
    _startDate: Date,
    _endDate: Date,
    itemId?: string
  ): Promise<Record<string, number>> {
    const whereClause: Prisma.RentalItemUnitWhereInput = {
      companyId,
      status: UnitStatus.AVAILABLE,
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
