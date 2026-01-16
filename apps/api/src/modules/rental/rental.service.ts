import { Prisma } from '@sync-erp/database';
import {
  prisma,
  RentalItem,
  RentalItemUnit,
  RentalOrder,
  RentalOrderStatus,
  RentalReturn,
  RentalPolicy,
  UnitStatus,
  UnitCondition,
  DepositPolicyType,
  DepositStatus,
  ReturnStatus,
  InvoiceType,
  InvoiceStatus,
  EntityType,
  AuditLogAction,
  PaymentMethod,
} from '@sync-erp/database';

export { Prisma };
import { RentalRepository } from './rental.repository';
import { JournalService } from '../accounting/services/journal.service';
import { RentalPolicy as Policy } from './rental.policy';
import { DocumentNumberService } from '../common/services/document-number.service';
import { recordAudit } from '../common/audit/audit-log.service';
import {
  DomainError,
  DomainErrorCodes,
  type CreateRentalItemInput,
  type CreateRentalOrderInput,
  type ConfirmRentalOrderInput,
  type ReleaseRentalOrderInput,
  type ProcessReturnInput,
  type RentalItemWithRelations,
  type RentalOrderWithRelations,
} from '@sync-erp/shared';
import { Decimal } from 'decimal.js';
import { calculateOptimalTier } from './rules/pricing';
import {
  calculateLateFee,
  calculateReturnSettlement,
} from './rules/late-fee';

import { z } from 'zod';

// Zod Schema for type-safe JSON parsing
const RentalPolicySnapshotSchema = z.object({
  gracePeriodHours: z.number(),
  lateFeeDailyRate: z.number(),
  cleaningFee: z.number(),
  pickupGracePeriodHours: z.number(),
});

type RentalPolicySnapshot = z.infer<
  typeof RentalPolicySnapshotSchema
>;

const DEFAULT_POLICY: RentalPolicySnapshot = {
  gracePeriodHours: 2,
  lateFeeDailyRate: 0,
  cleaningFee: 0,
  pickupGracePeriodHours: 2,
};

/**
 * Safely parse policySnapshot JSON from database with validation
 */
function parsePolicySnapshot(json: unknown): RentalPolicySnapshot {
  const result = RentalPolicySnapshotSchema.safeParse(json);
  return result.success ? result.data : DEFAULT_POLICY;
}

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

import { RentalWebhookService } from './rental-webhook.service';

export class RentalService {
  constructor(
    private readonly repository: RentalRepository = new RentalRepository(),
    private readonly documentNumberService: DocumentNumberService = new DocumentNumberService(),
    private readonly webhookService?: RentalWebhookService,
    private readonly journalService: JournalService = new JournalService()
  ) {}

  // ==========================================
  // Rental Items Management
  // ==========================================

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

  // REMOVED: addUnit - All units must now be created via convertStockToUnits
  // to ensure inventory integrity

  // REMOVED: bulkAddUnits - All units must now be created via convertStockToUnits
  // to ensure inventory integrity

  // REMOVED: bulkAddUnits - All units must now be created via convertStockToUnits
  // to ensure inventory integrity

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

  // ==========================================
  // Rental Orders Management
  // ==========================================

  async listOrders(
    companyId: string,
    filters?: {
      status?: RentalOrderStatus;
      partnerId?: string;
      dateRange?: { start: Date; end: Date };
      take?: number;
      cursor?: string;
    }
  ): Promise<{
    items: RentalOrderWithRelations[];
    nextCursor: string | null;
  }> {
    const take = filters?.take ?? 50;
    const items = (await this.repository.listRentalOrders(companyId, {
      ...filters,
      take: take + 1, // Fetch one extra to determine if more exist
      cursor: filters?.cursor,
    })) as unknown as RentalOrderWithRelations[];

    // Determine if there are more items
    const hasMore = items.length > take;
    const resultItems = hasMore ? items.slice(0, take) : items;
    const nextCursor = hasMore
      ? resultItems[resultItems.length - 1].id
      : null;

    return {
      items: resultItems,
      nextCursor,
    };
  }

  async createOrder(
    companyId: string,
    data: CreateRentalOrderInput,
    userId: string
  ): Promise<RentalOrder> {
    // Phase 1: Prepare
    // Validate dates
    if (data.rentalEndDate <= data.rentalStartDate) {
      throw new DomainError(
        'End date must be after start date',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    // List IDs
    const rentalItemIds = data.items
      .map((i) => i.rentalItemId)
      .filter((id): id is string => !!id);
    const rentalBundleIds = data.items
      .map((i) => i.rentalBundleId)
      .filter((id): id is string => !!id);

    // Fetch items and bundles
    const [items, bundles] = await Promise.all([
      prisma.rentalItem.findMany({
        where: { id: { in: rentalItemIds }, companyId },
      }),
      prisma.rentalBundle.findMany({
        where: { id: { in: rentalBundleIds }, companyId },
      }),
    ]);

    // Validate all found
    if (items.length !== new Set(rentalItemIds).size) {
      // Identify missing
      throw new DomainError(
        'Some rental items not found',
        404,
        DomainErrorCodes.ORDER_NOT_FOUND
      );
    }
    if (bundles.length !== new Set(rentalBundleIds).size) {
      throw new DomainError(
        'Some rental bundles not found',
        404,
        DomainErrorCodes.ORDER_NOT_FOUND
      );
    }

    // Phase 2: Orchestrate
    // Calculate rental duration
    const rentalDays = Math.ceil(
      (data.rentalEndDate.getTime() -
        data.rentalStartDate.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    // Calculate subtotal using pricing rules
    let subtotal = new Decimal(0);
    const orderItems: Prisma.RentalOrderItemCreateWithoutRentalOrderInput[] =
      [];

    for (const orderItem of data.items) {
      let dailyRate = 0;
      let weeklyRate = 0;
      let monthlyRate = 0;
      let itemId: string | undefined;
      let bundleId: string | undefined;

      if (orderItem.rentalItemId) {
        const item = items.find(
          (i) => i.id === orderItem.rentalItemId
        )!;
        dailyRate = item.dailyRate.toNumber();
        weeklyRate = item.weeklyRate.toNumber();
        monthlyRate = item.monthlyRate.toNumber();
        itemId = item.id;
      } else if (orderItem.rentalBundleId) {
        const bundle = bundles.find(
          (b) => b.id === orderItem.rentalBundleId
        )!;
        dailyRate = bundle.dailyRate.toNumber();
        weeklyRate = bundle.weeklyRate
          ? bundle.weeklyRate.toNumber()
          : dailyRate * 7;
        monthlyRate = bundle.monthlyRate
          ? bundle.monthlyRate.toNumber()
          : dailyRate * 30;
        bundleId = bundle.id;
      } else {
        continue; // Should be caught by validation
      }

      const tier = calculateOptimalTier(
        rentalDays,
        dailyRate,
        weeklyRate,
        monthlyRate
      );

      const itemTotal = tier.totalAmount.times(orderItem.quantity);
      subtotal = subtotal.plus(itemTotal);

      orderItems.push({
        rentalItem: itemId ? { connect: { id: itemId } } : undefined,
        rentalBundle: bundleId
          ? { connect: { id: bundleId } }
          : undefined,
        quantity: orderItem.quantity,
        unitPrice: tier.ratePerDay,
        subtotal: itemTotal,
        pricingTier: tier.tier,
      });
    }

    // Resolve dueDateTime default (if not provided, default to rentalEndDate)
    const dueDateTime = data.dueDateTime ?? data.rentalEndDate;

    // Snapshot current policy
    const policy = await this.repository.getCurrentPolicy(companyId);
    const policySnapshot = policy
      ? {
          gracePeriodHours: policy.gracePeriodHours,
          lateFeeDailyRate: policy.lateFeeDailyRate.toNumber(),
          cleaningFee: policy.cleaningFee.toNumber(),
          pickupGracePeriodHours: policy.pickupGracePeriodHours,
        }
      : null;

    // Generate order number
    const orderNumber = await this.documentNumberService.generate(
      companyId,
      'RNT'
    );

    // Phase 3: Execute
    const order = await this.repository.createRentalOrder(
      {
        company: { connect: { id: companyId } },
        partner: { connect: { id: data.partnerId } },
        orderNumber,
        rentalStartDate: data.rentalStartDate,
        rentalEndDate: data.rentalEndDate,
        dueDateTime,
        status: RentalOrderStatus.DRAFT,
        subtotal,
        depositAmount: new Decimal(0), // Will be set on confirmation
        totalAmount: subtotal,
        policySnapshot:
          (policySnapshot as Prisma.InputJsonValue) ||
          Prisma.JsonNull,
        notes: data.notes,
        createdBy: userId,
        items: {
          create: orderItems,
        },
      },
      undefined
    );

    // Phase 4: Post-Process
    await recordAudit({
      companyId,
      actorId: userId,
      action: AuditLogAction.RENTAL_ORDER_CREATED,
      entityType: EntityType.RENTAL_ORDER,
      entityId: order.id,
      businessDate: new Date(),
    });

    return order;
  }

  async getOrderById(
    _companyId: string,
    orderId: string
  ): Promise<RentalOrderWithRelations | null> {
    return this.repository.findOrderById(orderId);
  }

  async confirmOrder(
    companyId: string,
    input: ConfirmRentalOrderInput,
    userId: string
  ): Promise<RentalOrder> {
    return prisma.$transaction(async (tx) => {
      // Phase 1: Prepare
      const order = await this.repository.findOrderById(
        input.orderId,
        tx
      );
      if (!order || order.companyId !== companyId) {
        throw new DomainError(
          'Order not found',
          404,
          DomainErrorCodes.ORDER_NOT_FOUND
        );
      }

      if (order.status !== RentalOrderStatus.DRAFT) {
        throw new DomainError(
          'Can only confirm DRAFT orders',
          400,
          DomainErrorCodes.OPERATION_NOT_ALLOWED
        );
      }

      // AUTO-ASSIGN UNITS if not provided
      // Get order items with their rental item info
      const orderItems = await tx.rentalOrderItem.findMany({
        where: { rentalOrderId: order.id },
        include: {
          rentalItem: true,
          rentalBundle: {
            include: {
              components: {
                include: { rentalItem: true },
              },
            },
          },
        },
      });

      // Build list of required units per rentalItemId
      const requiredUnits: Map<string, number> = new Map();
      for (const item of orderItems) {
        if (item.rentalBundleId && item.rentalBundle?.components) {
          // Bundle: need units for each component
          for (const comp of item.rentalBundle.components) {
            if (comp.rentalItemId) {
              const current =
                requiredUnits.get(comp.rentalItemId) || 0;
              requiredUnits.set(
                comp.rentalItemId,
                current + comp.quantity * item.quantity
              );
            }
          }
        } else if (item.rentalItemId) {
          // Standalone item
          const current = requiredUnits.get(item.rentalItemId) || 0;
          requiredUnits.set(
            item.rentalItemId,
            current + item.quantity
          );
        }
      }

      const totalQuantityRequired = Array.from(
        requiredUnits.values()
      ).reduce((a, b) => a + b, 0);

      // Use provided unitAssignments or auto-assign
      let unitIds: string[];
      if (input.unitAssignments && input.unitAssignments.length > 0) {
        // Manual assignment provided
        unitIds = input.unitAssignments.map((a) => a.unitId);
        if (unitIds.length < totalQuantityRequired) {
          throw new DomainError(
            `Need ${totalQuantityRequired} units but only ${unitIds.length} provided`,
            400,
            DomainErrorCodes.INVALID_INPUT
          );
        }
      } else {
        // AUTO-ASSIGN: Find available units for each required rental item
        unitIds = [];
        for (const [rentalItemId, qty] of requiredUnits.entries()) {
          const availableUnits = await tx.rentalItemUnit.findMany({
            where: {
              rentalItemId,
              companyId,
              status: UnitStatus.AVAILABLE,
            },
            take: qty,
            orderBy: { unitCode: 'asc' },
          });

          if (availableUnits.length < qty) {
            throw new DomainError(
              `Insufficient available units for rental item. Need ${qty}, found ${availableUnits.length}`,
              400,
              DomainErrorCodes.INSUFFICIENT_STOCK
            );
          }

          unitIds.push(...availableUnits.map((u) => u.id));
        }
      }

      // Validate units exist
      const units = await tx.rentalItemUnit.findMany({
        where: { id: { in: unitIds }, companyId },
      });

      if (units.length !== unitIds.length) {
        throw new DomainError(
          'One or more units not found',
          400,
          DomainErrorCodes.INVALID_INPUT
        );
      }

      // Pre-check status
      Policy.ensureUnitsAvailable(units, unitIds);

      // Phase 2: Orchestrate
      // Get current policy for deposit policyType, auto-create if not exists
      let policy = await this.repository.getCurrentPolicy(companyId);
      if (!policy) {
        // Auto-create default policy for better UX
        policy = await tx.rentalPolicy.create({
          data: {
            companyId,
            gracePeriodHours: 24,
            lateFeeDailyRate: 50000, // Default 50k/day late fee
            cleaningFee: 25000, // Default 25k cleaning fee
            pickupGracePeriodHours: 48,
            defaultDepositPolicyType: DepositPolicyType.PER_UNIT,
            defaultDepositPerUnit: 100000, // Default 100k per unit
            createdBy: userId,
            isActive: true,
          },
        });
      }

      // Use pre-calculated deposit from order (set during order creation)
      const depositAmount = order.depositAmount
        ? new Decimal(order.depositAmount.toString())
        : new Decimal(0);

      // PaymentMethod: use from order or default to BANK_TRANSFER
      const paymentMethodStr =
        input.paymentMethod ||
        order.paymentMethod ||
        PaymentMethod.BANK_TRANSFER;

      // Create deposit allocations (using unitIds - either provided or auto-assigned)
      const allocations = unitIds.map((unitId) => {
        const perUnitAmount = depositAmount.dividedBy(
          unitIds.length || 1
        );
        return {
          unitId,
          maxCoveredAmount: perUnitAmount,
        };
      });

      // Phase 3: Execute
      // Create deposit
      const deposit = await tx.rentalDeposit.create({
        data: {
          rentalOrderId: order.id,
          companyId,
          amount: depositAmount,
          policyType: policy.defaultDepositPolicyType,
          status: DepositStatus.COLLECTED,
          collectedAt: new Date(),
          paymentMethod: paymentMethodStr,
          allocations: {
            create: allocations,
          },
        },
      });

      // Create unit assignments (using unitIds)
      await tx.rentalOrderUnitAssignment.createMany({
        data: unitIds.map((unitId) => ({
          rentalOrderId: order.id,
          rentalItemUnitId: unitId,
          lockedBy: userId,
        })),
      });

      // Reserve units (Optimistic Locking)
      const reservationResult = await tx.rentalItemUnit.updateMany({
        where: {
          id: { in: unitIds },
          status: UnitStatus.AVAILABLE, // CRITICAL: Only update if STILL available
        },
        data: { status: UnitStatus.RESERVED },
      });

      if (reservationResult.count !== unitIds.length) {
        throw new DomainError(
          'One or more units were reserved by another user. Please try again.',
          409, // Conflict
          DomainErrorCodes.INSUFFICIENT_STOCK
        );
      }

      // Update order
      const updated = await tx.rentalOrder.update({
        where: { id: order.id },
        data: {
          status: RentalOrderStatus.CONFIRMED,
          depositAmount,
          confirmedAt: new Date(),
        },
        include: {
          items: true,
          unitAssignments: true,
          deposit: true,
        },
      });

      // Post deposit journal
      await this.journalService.postRentalDeposit(
        companyId,
        deposit.id,
        order.orderNumber!,
        Number(depositAmount),
        paymentMethodStr,
        tx
      );

      // Phase 4: Post-Process
      await recordAudit({
        companyId,
        actorId: userId,
        action: AuditLogAction.RENTAL_ORDER_CONFIRMED,
        entityType: EntityType.RENTAL_ORDER,
        entityId: order.id,
        businessDate: new Date(),
        payloadSnapshot: { depositId: deposit.id },
      });

      return updated;
    });
  }

  async releaseOrder(
    companyId: string,
    input: ReleaseRentalOrderInput,
    userId: string
  ): Promise<RentalOrder> {
    return prisma.$transaction(async (tx) => {
      // Phase 1: Prepare
      const order = await this.repository.findOrderById(
        input.orderId,
        tx
      );
      if (!order || order.companyId !== companyId) {
        throw new DomainError(
          'Order not found',
          404,
          DomainErrorCodes.ORDER_NOT_FOUND
        );
      }

      Policy.ensureCanRelease(order);

      // Validate all units have photos
      const unitIds = input.unitAssignments.map((a) => a.unitId);
      for (const assignment of input.unitAssignments) {
        if (
          !assignment.beforePhotos ||
          assignment.beforePhotos.length === 0
        ) {
          throw new DomainError(
            'All units must have before photos',
            400,
            DomainErrorCodes.INVALID_INPUT
          );
        }
      }

      // Phase 2: Orchestrate & Execute
      // Create condition logs
      await Promise.all(
        input.unitAssignments.map((assignment) =>
          tx.itemConditionLog.create({
            data: {
              rentalItemUnit: { connect: { id: assignment.unitId } },
              rentalOrder: { connect: { id: order.id } },
              conditionType: 'RELEASE',
              beforePhotos: assignment.beforePhotos,
              afterPhotos: [],
              condition: assignment.condition,
              notes: assignment.notes,
              recordedAt: new Date(),
              assessedBy: userId,
            },
          })
        )
      );

      // Set units to RENTED
      await tx.rentalItemUnit.updateMany({
        where: { id: { in: unitIds } },
        data: { status: UnitStatus.RENTED },
      });

      // Update order
      const updated = await tx.rentalOrder.update({
        where: { id: order.id },
        data: {
          status: RentalOrderStatus.ACTIVE,
          activatedAt: new Date(),
        },
        include: {
          items: true,
          unitAssignments: true,
          deposit: true,
        },
      });

      // Phase 4: Post-Process
      await recordAudit({
        companyId,
        actorId: userId,
        action: AuditLogAction.RENTAL_ORDER_RELEASED,
        entityType: EntityType.RENTAL_ORDER,
        entityId: order.id,
        businessDate: new Date(),
        payloadSnapshot: { unitCount: unitIds.length },
      });

      return updated;
    });
  }

  async cancelOrder(
    companyId: string,
    orderId: string,
    reason: string,
    userId: string
  ): Promise<RentalOrder> {
    return prisma.$transaction(async (tx) => {
      const order = await tx.rentalOrder.findUnique({
        where: { id: orderId },
        include: { deposit: true },
      });
      if (!order || order.companyId !== companyId) {
        throw new DomainError(
          'Order not found',
          404,
          DomainErrorCodes.ORDER_NOT_FOUND
        );
      }

      if (
        order.status !== RentalOrderStatus.DRAFT &&
        order.status !== RentalOrderStatus.CONFIRMED
      ) {
        throw new DomainError(
          'Can only cancel DRAFT or CONFIRMED orders',
          400,
          DomainErrorCodes.ORDER_INVALID_STATE
        );
      }

      // Release reserved units
      const assignments = await tx.rentalOrderUnitAssignment.findMany(
        {
          where: { rentalOrderId: orderId },
        }
      );

      if (assignments.length > 0) {
        await tx.rentalItemUnit.updateMany({
          where: {
            id: { in: assignments.map((a) => a.rentalItemUnitId) },
          },
          data: { status: UnitStatus.AVAILABLE },
        });
      }

      // Handle deposit refund if collected
      if (order.deposit) {
        await tx.rentalDeposit.update({
          where: { id: order.deposit.id },
          data: {
            status: DepositStatus.REFUNDED,
            refundedAt: new Date(),
          },
        });
      }

      const updated = await tx.rentalOrder.update({
        where: { id: orderId },
        data: {
          status: RentalOrderStatus.CANCELLED,
          cancelledAt: new Date(),
          notes: reason,
        },
      });

      await recordAudit({
        companyId,
        actorId: userId,
        action: AuditLogAction.RENTAL_ORDER_CANCELLED,
        entityType: EntityType.RENTAL_ORDER,
        entityId: orderId,
        businessDate: new Date(),
        payloadSnapshot: { reason },
      });

      return updated;
    });
  }

  // ==========================================
  // Payment Verification (for website orders)
  // ==========================================

  async verifyPayment(
    companyId: string,
    orderId: string,
    action: 'confirm' | 'reject',
    userId: string,
    paymentReference?: string,
    failReason?: string
  ): Promise<RentalOrder> {
    const { RentalPaymentStatus, OrderSource } =
      await import('@sync-erp/database');

    return prisma.$transaction(async (tx) => {
      const order = await tx.rentalOrder.findUnique({
        where: { id: orderId },
      });

      if (!order || order.companyId !== companyId) {
        throw new DomainError(
          'Order not found',
          404,
          DomainErrorCodes.ORDER_NOT_FOUND
        );
      }

      // Only AWAITING_CONFIRM payments can be verified
      if (
        order.rentalPaymentStatus !==
        RentalPaymentStatus.AWAITING_CONFIRM
      ) {
        throw new DomainError(
          'Only payments with AWAITING_CONFIRM status can be verified',
          400,
          DomainErrorCodes.ORDER_INVALID_STATE
        );
      }

      // Auto-confirm website orders when payment is verified
      const shouldAutoConfirm =
        action === 'confirm' &&
        order.orderSource === OrderSource.WEBSITE &&
        order.status === RentalOrderStatus.DRAFT;

      const updateData: Prisma.RentalOrderUpdateInput =
        action === 'confirm'
          ? {
              rentalPaymentStatus: RentalPaymentStatus.CONFIRMED,
              paymentConfirmedAt: new Date(),
              paymentConfirmedBy: userId,
              paymentReference: paymentReference || undefined,
              // Auto-confirm website orders
              ...(shouldAutoConfirm
                ? {
                    status: RentalOrderStatus.CONFIRMED,
                    confirmedAt: new Date(),
                  }
                : {}),
            }
          : {
              rentalPaymentStatus: RentalPaymentStatus.FAILED,
              paymentFailedAt: new Date(),
              paymentFailReason:
                failReason || 'Payment verification failed',
            };

      const updated = await tx.rentalOrder.update({
        where: { id: orderId },
        data: updateData,
      });

      await recordAudit({
        companyId,
        actorId: userId,
        action:
          action === 'confirm'
            ? AuditLogAction.RENTAL_ORDER_CONFIRMED
            : AuditLogAction.RENTAL_ORDER_CANCELLED,
        entityType: EntityType.RENTAL_ORDER,
        entityId: orderId,
        businessDate: new Date(),
        payloadSnapshot: {
          action: `payment_${action}`,
          paymentReference,
          failReason,
          autoConfirmed: shouldAutoConfirm,
        },
      });

      // Fire webhook notification (async, non-blocking)
      if (this.webhookService && order.publicToken) {
        this.webhookService
          .notifyPaymentStatus({
            token: order.publicToken,
            action: action === 'confirm' ? 'confirmed' : 'rejected',
            paymentReference,
            failReason,
          })
          .catch((err) => {
            console.error(
              '[RentalService] Webhook notification failed:',
              err
            );
          });
      }

      return updated;
    });
  }

  // ==========================================
  // Order Extensions
  // ==========================================

  async extendOrder(
    companyId: string,
    input: {
      orderId: string;
      newEndDate: Date;
      additionalDeposit?: number;
      reason?: string;
    },
    userId: string
  ): Promise<RentalOrder> {
    return prisma.$transaction(async (tx) => {
      // Phase 1: Prepare
      const order = await tx.rentalOrder.findUnique({
        where: { id: input.orderId },
        include: {
          items: { include: { rentalItem: true } },
          extensions: true,
        },
      });

      if (!order || order.companyId !== companyId) {
        throw new DomainError(
          'Order not found',
          404,
          DomainErrorCodes.ORDER_NOT_FOUND
        );
      }

      // Only ACTIVE or CONFIRMED orders can be extended
      if (
        order.status !== RentalOrderStatus.ACTIVE &&
        order.status !== RentalOrderStatus.CONFIRMED
      ) {
        throw new DomainError(
          'Can only extend ACTIVE or CONFIRMED orders',
          400,
          DomainErrorCodes.OPERATION_NOT_ALLOWED
        );
      }

      // New end date must be after current end date
      if (input.newEndDate <= order.rentalEndDate) {
        throw new DomainError(
          'New end date must be after current end date',
          400,
          DomainErrorCodes.INVALID_INPUT
        );
      }

      // Phase 2: Calculate extension charges
      const additionalDays = Math.ceil(
        (input.newEndDate.getTime() - order.rentalEndDate.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      // Calculate extension amount based on items
      let additionalAmount = new Decimal(0);
      for (const item of order.items) {
        // Skip bundle items - they don't have individual rental item rates
        if (!item.rentalItem) continue;

        const tier = calculateOptimalTier(
          additionalDays,
          Number(item.rentalItem.dailyRate),
          Number(item.rentalItem.weeklyRate),
          Number(item.rentalItem.monthlyRate)
        );
        additionalAmount = additionalAmount.plus(
          tier.totalAmount.times(item.quantity)
        );
      }

      // Phase 3: Execute
      const extensionNumber = (order.extensions?.length || 0) + 1;

      const extension = await tx.rentalOrderExtension.create({
        data: {
          rentalOrderId: order.id,
          companyId,
          extensionNumber,
          previousEndDate: order.rentalEndDate,
          newEndDate: input.newEndDate,
          additionalDays,
          additionalAmount,
          additionalDeposit: input.additionalDeposit || 0,
          reason: input.reason,
          createdBy: userId,
        },
      });

      // Update order end dates
      const newDueDateTime = new Date(
        input.newEndDate.getTime() + 18 * 60 * 60 * 1000 // 18:00 on new end date
      );

      const updatedOrder = await tx.rentalOrder.update({
        where: { id: order.id },
        data: {
          rentalEndDate: input.newEndDate,
          dueDateTime: newDueDateTime,
          subtotal: order.subtotal.plus(additionalAmount),
        },
        include: { items: true, extensions: true },
      });

      // Post extension journal if there's additional charge
      if (additionalAmount.gt(0)) {
        await this.journalService.postRentalDeposit(
          companyId,
          extension.id,
          order.orderNumber!,
          Number(additionalAmount),
          'CASH', // Default, should be passed
          tx
        );
      }

      // Phase 4: Post-Process
      await recordAudit({
        companyId,
        actorId: userId,
        action: AuditLogAction.RENTAL_ORDER_CONFIRMED, // TODO: Add RENTAL_ORDER_EXTENDED
        entityType: EntityType.RENTAL_ORDER,
        entityId: order.id,
        businessDate: new Date(),
        payloadSnapshot: {
          extensionNumber,
          additionalDays,
          additionalAmount: additionalAmount.toString(),
        },
      });

      return updatedOrder;
    });
  }

  // ==========================================
  // Returns & Settlement
  // ==========================================

  async processReturn(
    companyId: string,
    input: ProcessReturnInput,
    userId: string
  ): Promise<RentalReturn> {
    return prisma.$transaction(async (tx) => {
      // Phase 1: Prepare
      const order = await this.repository.findOrderById(
        input.orderId,
        tx
      );
      if (!order || order.companyId !== companyId) {
        throw new DomainError(
          'Order not found',
          404,
          DomainErrorCodes.ORDER_NOT_FOUND
        );
      }

      Policy.ensureCanReturn(order);

      // Check if return already exists for this order
      const existingReturn = await tx.rentalReturn.findUnique({
        where: { rentalOrderId: order.id },
      });
      if (existingReturn) {
        throw new DomainError(
          'Return sudah pernah diproses untuk order ini',
          400,
          DomainErrorCodes.RETURN_ALREADY_PROCESSED
        );
      }

      // Phase 2: Orchestrate - Calculate charges
      const policy = parsePolicySnapshot(order.policySnapshot);
      const lateFeeCalc = calculateLateFee(
        order.dueDateTime,
        input.actualReturnDate,
        policy.gracePeriodHours || 2,
        new Decimal(policy.lateFeeDailyRate || 0),
        order.subtotal.div(
          Math.ceil(
            (order.rentalEndDate.getTime() -
              order.rentalStartDate.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        )
      );

      // Sum damage charges based on severity (from damage policy)
      let damageCharges = new Decimal(0);

      // Batch fetch units with product relation for category matching
      const unitIds = input.units.map((u) => u.unitId);
      const unitsList = await tx.rentalItemUnit.findMany({
        where: { id: { in: unitIds } },
        include: {
          rentalItem: {
            include: {
              product: { include: { category: true } },
            },
          },
        },
      });
      const unitsMap = new Map(unitsList.map((u) => [u.id, u]));

      // Batch fetch damage policies for the whole company
      // This is generally small enough to load into memory (10-50 rules)
      const damagePolicies = await tx.rentalDamagePolicy.findMany({
        where: { companyId, isActive: true },
        orderBy: [
          { rentalItemId: 'desc' }, // Specific first
          { category: 'desc' }, // Category second
        ],
      });

      for (const u of input.units) {
        if (!u.damageSeverity) continue;

        const unit = unitsMap.get(u.unitId);
        if (!unit) continue;

        // In-memory policy match
        const matchedPolicy = damagePolicies.find(
          (p) =>
            p.severity === u.damageSeverity &&
            (p.rentalItemId === unit.rentalItemId || // Item Match
              (p.category ===
                unit.rentalItem?.product?.category?.name &&
                !p.rentalItemId) || // Category Match
              (!p.category && !p.rentalItemId)) // Global Match
        );

        const severityCharge = matchedPolicy
          ? Number(matchedPolicy.charge)
          : u.damageSeverity === 'MINOR'
            ? 50000
            : u.damageSeverity === 'MAJOR'
              ? 150000
              : u.damageSeverity === 'UNUSABLE'
                ? 500000
                : 0;

        damageCharges = damageCharges.plus(severityCharge);
      }

      // Settlement calculation
      const settlement = calculateReturnSettlement(
        lateFeeCalc,
        damageCharges,
        order.depositAmount
      );

      // Phase 3: Execute
      // Create condition logs
      await Promise.all(
        input.units.map((unit) =>
          tx.itemConditionLog.create({
            data: {
              rentalItemUnitId: unit.unitId,
              rentalOrderId: order.id,
              conditionType: 'RETURN',
              beforePhotos: [],
              afterPhotos: unit.afterPhotos,
              condition: unit.condition,
              damageSeverity: unit.damageSeverity || null,
              notes: unit.damageNotes,
              recordedAt: input.actualReturnDate,
              assessedBy: userId,
            },
          })
        )
      );

      // Set units to RETURNED
      await tx.rentalItemUnit.updateMany({
        where: { id: { in: input.units.map((u) => u.unitId) } },
        data: { status: UnitStatus.RETURNED },
      });

      // Create return record
      const rentalReturn = await tx.rentalReturn.create({
        data: {
          rentalOrderId: order.id,
          companyId,
          returnedAt: input.actualReturnDate,
          baseRentalFee: order.subtotal,
          lateFee: lateFeeCalc.totalLateFee,
          damageCharges,
          cleaningFee: new Decimal(policy.cleaningFee || 0),
          totalCharges: settlement.totalCharges,
          depositDeduction: settlement.depositDeduction,
          depositRefund: settlement.depositRefund,
          additionalChargesDue: settlement.additionalChargesDue,
          settlementStatus: ReturnStatus.DRAFT,
          processedBy: userId,
        },
      });

      // Update order status to COMPLETED
      await tx.rentalOrder.update({
        where: { id: order.id },
        data: {
          status: RentalOrderStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      // Phase 4: Post-Process
      await recordAudit({
        companyId,
        actorId: userId,
        action: AuditLogAction.RENTAL_RETURN_PROCESSED,
        entityType: EntityType.RENTAL_RETURN,
        entityId: rentalReturn.id,
        businessDate: new Date(),
        payloadSnapshot: {
          orderId: order.id,
          lateFee: lateFeeCalc.totalLateFee.toString(),
          damages: damageCharges.toString(),
        },
      });

      return rentalReturn;
    });
  }

  async finalizeReturn(
    companyId: string,
    returnId: string,
    userId: string
  ): Promise<RentalReturn> {
    return prisma.$transaction(async (tx) => {
      const returnRecord = await tx.rentalReturn.findUnique({
        where: { id: returnId },
        include: {
          rentalOrder: {
            include: { deposit: true, unitAssignments: true },
          },
        },
      });

      if (!returnRecord || returnRecord.companyId !== companyId) {
        throw new DomainError(
          'Return not found',
          404,
          DomainErrorCodes.ORDER_NOT_FOUND
        );
      }

      Policy.validateSettlement(returnRecord);

      // Update deposit status
      if (returnRecord.rentalOrder.deposit) {
        const depositStatus =
          returnRecord.depositRefund.gt(0) &&
          returnRecord.depositDeduction.gt(0)
            ? DepositStatus.PARTIAL_REFUND
            : returnRecord.depositRefund.isZero()
              ? DepositStatus.FORFEITED
              : DepositStatus.REFUNDED;

        await tx.rentalDeposit.update({
          where: { id: returnRecord.rentalOrder.deposit.id },
          data: {
            status: depositStatus,
            refundedAt:
              depositStatus !== DepositStatus.FORFEITED
                ? new Date()
                : null,
          },
        });
      }

      // Set units to CLEANING (auto-trigger)
      const unitIds = returnRecord.rentalOrder.unitAssignments.map(
        (a) => a.rentalItemUnitId
      );
      await tx.rentalItemUnit.updateMany({
        where: { id: { in: unitIds } },
        data: { status: UnitStatus.CLEANING },
      });

      // Finalize return
      const finalized = await tx.rentalReturn.update({
        where: { id: returnId },
        data: {
          settlementStatus: ReturnStatus.SETTLED,
          settledAt: new Date(),
        },
      });

      // Complete order
      await tx.rentalOrder.update({
        where: { id: returnRecord.rentalOrderId },
        data: {
          status: RentalOrderStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      // Post return journal (revenue recognition and deposit settlement)
      if (returnRecord.rentalOrder.deposit) {
        const deposit = returnRecord.rentalOrder.deposit;
        // Revenue = totalCharges (base rental + late fees + damages + cleaning)
        const rentalRevenue = Number(returnRecord.totalCharges);

        await this.journalService.postRentalReturn(
          companyId,
          returnId,
          returnRecord.rentalOrder.orderNumber!,
          Number(deposit.amount),
          rentalRevenue,
          Number(returnRecord.depositRefund),
          deposit.paymentMethod || 'CASH',
          tx
        );

        // Create refund payment record if there's a refund
        if (returnRecord.depositRefund.gt(0)) {
          await tx.payment.create({
            data: {
              companyId,
              amount: returnRecord.depositRefund.negated(), // Negative = outgoing payment
              method:
                (deposit.paymentMethod as PaymentMethod) ||
                PaymentMethod.CASH,
              paymentType: 'DEPOSIT_REFUND',
              reference: `Refund: ${returnRecord.rentalOrder.orderNumber}`,
              date: new Date(),
            },
          });
        }
      }

      await recordAudit({
        companyId,
        actorId: userId,
        action: AuditLogAction.RENTAL_RETURN_SETTLED,
        entityType: EntityType.RENTAL_RETURN,
        entityId: returnId,
        businessDate: new Date(),
      });

      return finalized;
    });
  }

  // ==========================================
  // AR & Invoicing
  // ==========================================

  async createInvoiceFromReturn(companyId: string, returnId: string) {
    return prisma.$transaction(async (tx) => {
      const returnRecord = await tx.rentalReturn.findUnique({
        where: { id: returnId },
        include: { rentalOrder: { include: { partner: true } } },
      });

      if (!returnRecord || returnRecord.companyId !== companyId) {
        throw new DomainError(
          'Return not found',
          404,
          DomainErrorCodes.ORDER_NOT_FOUND
        );
      }

      // Check if there are additional charges
      if (returnRecord.additionalChargesDue.lte(0)) {
        throw new DomainError(
          'No additional charges due for this return',
          400,
          DomainErrorCodes.OPERATION_NOT_ALLOWED
        );
      }

      // Create Invoice
      const invoice = await tx.invoice.create({
        data: {
          companyId,
          partnerId: returnRecord.rentalOrder.partnerId,
          type: InvoiceType.RENTAL,
          status: InvoiceStatus.DRAFT,
          dueDate: new Date(), // Due immediately
          amount: returnRecord.additionalChargesDue,
          subtotal: returnRecord.additionalChargesDue,
          taxAmount: 0,
          balance: returnRecord.additionalChargesDue,
          notes: `Auto-generated invoice for rental overage charges. Ref: ${returnRecord.rentalOrder.orderNumber}`,
          items: {
            create: [
              {
                description:
                  'Additional Rental Charges (Late/Damage/Cleaning)',
                quantity: 1,
                price: returnRecord.additionalChargesDue,
                amount: returnRecord.additionalChargesDue,
              },
            ],
          },
        },
      });

      return invoice;
    });
  }

  // ==========================================
  // Policy Management
  // ==========================================

  async getCurrentPolicy(
    companyId: string
  ): Promise<RentalPolicy | null> {
    return this.repository.getCurrentPolicy(companyId);
  }

  async updatePolicy(
    companyId: string,
    data: {
      gracePeriodHours?: number;
      lateFeeDailyRate?: number;
      cleaningFee?: number;
      pickupGracePeriodHours?: number;
    },
    userId: string
  ): Promise<RentalPolicy> {
    return prisma.$transaction(async (tx) => {
      // Mark current policy inactive
      const current = await this.repository.getCurrentPolicy(
        companyId,
        tx
      );
      if (current) {
        await tx.rentalPolicy.update({
          where: { id: current.id },
          data: { isActive: false, replacedAt: new Date() },
        });
      }

      // Create new policy
      const newPolicy = await tx.rentalPolicy.create({
        data: {
          company: { connect: { id: companyId } },
          gracePeriodHours:
            data.gracePeriodHours ?? current?.gracePeriodHours ?? 2,
          lateFeeDailyRate: data.lateFeeDailyRate
            ? new Decimal(data.lateFeeDailyRate)
            : (current?.lateFeeDailyRate ?? new Decimal(0)),
          cleaningFee: data.cleaningFee
            ? new Decimal(data.cleaningFee)
            : (current?.cleaningFee ?? new Decimal(0)),
          pickupGracePeriodHours:
            data.pickupGracePeriodHours ??
            current?.pickupGracePeriodHours ??
            24,
          defaultDepositPolicyType:
            current?.defaultDepositPolicyType ?? 'PERCENTAGE',
          createdBy: userId,
          isActive: true,
          effectiveFrom: new Date(),
        },
      });

      await recordAudit({
        companyId,
        actorId: userId,
        action: AuditLogAction.RENTAL_ITEM_CREATED,
        entityType: EntityType.RENTAL_POLICY,
        entityId: newPolicy.id,
        businessDate: new Date(),
      });

      return newPolicy;
    });
  }

  // ==========================================
  // Availability Queries
  // ==========================================

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

  /**
   * Get scheduler timeline data for Gantt view
   * Returns all rental items with their units and booking blocks
   */
  async getSchedulerTimeline(
    companyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    items: Array<{
      id: string;
      name: string;
      units: Array<{
        id: string;
        unitCode: string;
        status: string;
        bookings: Array<{
          orderId: string;
          orderNumber: string;
          partnerName: string;
          startDate: Date;
          endDate: Date;
          status: string;
        }>;
      }>;
    }>;
  }> {
    // Fetch rental items with units
    const items = await prisma.rentalItem.findMany({
      where: { companyId },
      include: {
        product: { select: { name: true } },
        units: {
          orderBy: { unitCode: 'asc' },
        },
      },
    });

    // Fetch orders that overlap with the date range
    const orders = await prisma.rentalOrder.findMany({
      where: {
        companyId,
        status: {
          in: [RentalOrderStatus.CONFIRMED, RentalOrderStatus.ACTIVE],
        },
        OR: [
          {
            rentalStartDate: { lte: endDate },
            rentalEndDate: { gte: startDate },
          },
        ],
      },
      include: {
        partner: { select: { name: true } },
        unitAssignments: {
          select: { rentalItemUnitId: true },
        },
      },
    });

    // Create a map of unit -> bookings
    const unitBookings = new Map<
      string,
      Array<{
        orderId: string;
        orderNumber: string;
        partnerName: string;
        startDate: Date;
        endDate: Date;
        status: string;
      }>
    >();

    for (const order of orders) {
      for (const assignment of order.unitAssignments) {
        const unitId = assignment.rentalItemUnitId;
        if (!unitBookings.has(unitId)) {
          unitBookings.set(unitId, []);
        }
        unitBookings.get(unitId)!.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          partnerName: order.partner?.name || 'Unknown',
          startDate: order.rentalStartDate,
          endDate: order.rentalEndDate,
          status: order.status,
        });
      }
    }

    // Build the response
    return {
      items: items.map((item) => ({
        id: item.id,
        name: item.product?.name || 'Unknown',
        units: item.units.map((unit) => ({
          id: unit.id,
          unitCode: unit.unitCode,
          status: unit.status,
          bookings: unitBookings.get(unit.id) || [],
        })),
      })),
    };
  }
}
