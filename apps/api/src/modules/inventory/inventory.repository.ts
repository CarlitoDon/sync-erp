import {
  Prisma,
  prisma,
  InventoryMovement,
  MovementType,
  FulfillmentType,
  InvoiceType,
  SequenceType,
} from '@sync-erp/database';

export interface StockMovementInput {
  companyId: string;
  productId: string;
  warehouseId?: string;
  type: MovementType;
  quantity: number;
  reference?: string;
  unitCost?: number;
}

export class InventoryRepository {
  /**
   * Universal Stock Journal Helper
   * - Creates InventoryMovement
   * - Updates Product Stock Qty
   * - Updates Product Average Cost (if IN)
   */
  async createStockMovement(
    data: StockMovementInput,
    tx: Prisma.TransactionClient
  ) {
    const movement = await tx.inventoryMovement.create({
      data: {
        companyId: data.companyId,
        productId: data.productId,
        warehouseId: data.warehouseId,
        type: data.type,
        quantity: data.quantity,
        reference: data.reference,
      },
    });

    const delta =
      data.type === MovementType.IN ? data.quantity : -data.quantity;

    const product = await tx.product.findUniqueOrThrow({
      where: { id: data.productId },
    });

    let newAverageCost = product.averageCost;

    if (
      data.type === MovementType.IN &&
      data.unitCost !== undefined
    ) {
      const oldQty = product.stockQty;
      const oldAvg = Number(product.averageCost);
      const inQty = data.quantity;
      const inCost = data.unitCost;

      const totalValue = oldQty * oldAvg + inQty * inCost;
      const newQty = oldQty + inQty;

      if (newQty > 0) {
        newAverageCost = new Prisma.Decimal(totalValue / newQty);
      }
    }

    await tx.product.update({
      where: { id: data.productId },
      data: {
        stockQty: { increment: delta },
        averageCost: newAverageCost,
      },
    });

    return movement;
  }

  // ==========================================
  // Movement Methods
  // ==========================================

  async createMovement(
    data: Prisma.InventoryMovementUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ): Promise<InventoryMovement> {
    const db = tx || prisma;
    return db.inventoryMovement.create({ data });
  }

  async findMovements(
    companyId: string,
    productId?: string,
    tx?: Prisma.TransactionClient
  ): Promise<InventoryMovement[]> {
    const db = tx || prisma;
    return db.inventoryMovement.findMany({
      where: {
        companyId,
        ...(productId && { productId }),
      },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<InventoryMovement | null> {
    const db = tx || prisma;
    return db.inventoryMovement.findUnique({ where: { id } });
  }

  async countByReferencePatterns(
    companyId: string,
    patterns: string[],
    type: MovementType = MovementType.IN,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const db = tx || prisma;
    if (patterns.length === 0) return 0;
    return db.inventoryMovement.count({
      where: {
        companyId,
        type,
        OR: patterns.map((p) => ({ reference: { contains: p } })),
      },
    });
  }

  // ==========================================
  // Order Query Methods
  // ==========================================

  async findOrderWithItems(
    orderId: string,
    companyId: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.order.findFirst({
      where: { id: orderId, companyId },
      include: { items: true },
    });
  }

  async updateOrderItemCost(
    orderItemId: string,
    cost: number | Prisma.Decimal,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.orderItem.update({
      where: { id: orderItemId },
      data: { cost },
    });
  }

  // ==========================================
  // Fulfillment Methods (Replaces GRN + Shipment)
  // ==========================================

  async generateFulfillmentNumber(
    companyId: string,
    type: FulfillmentType,
    tx?: Prisma.TransactionClient
  ): Promise<string> {
    const db = tx || prisma;
    const year = new Date().getFullYear();
    let prefix: string;
    if (type === FulfillmentType.RECEIPT) {
      prefix = SequenceType.GRN;
    } else if (type === FulfillmentType.RETURN) {
      prefix = SequenceType.RET;
    } else if (type === FulfillmentType.PURCHASE_RETURN) {
      prefix = SequenceType.PRR;
    } else {
      prefix = SequenceType.SHP;
    }
    const count = await db.fulfillment.count({
      where: { companyId, type },
    });
    return `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  async getFulfilledQuantitiesForOrder(
    orderId: string,
    type: FulfillmentType,
    tx?: Prisma.TransactionClient
  ): Promise<Map<string, number>> {
    const db = tx || prisma;
    const items = await db.fulfillmentItem.findMany({
      where: {
        fulfillment: {
          orderId,
          type,
          status: 'POSTED',
        },
      },
      select: { productId: true, quantity: true },
    });

    const map = new Map<string, number>();
    for (const item of items) {
      const current = map.get(item.productId) || 0;
      map.set(item.productId, current + Number(item.quantity));
    }
    return map;
  }

  async createFulfillment(
    data: {
      companyId: string;
      orderId: string;
      type: FulfillmentType;
      date: Date;
      notes?: string;
      receivedBy?: string;
      items: {
        productId: string;
        quantity: number;
        orderItemId: string;
      }[];
    },
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const number = await this.generateFulfillmentNumber(
      data.companyId,
      data.type,
      tx
    );

    return db.fulfillment.create({
      data: {
        companyId: data.companyId,
        orderId: data.orderId,
        type: data.type,
        number,
        date: data.date,
        notes: data.notes,
        receivedBy: data.receivedBy,
        status: 'DRAFT',
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            orderItemId: item.orderItemId,
          })),
        },
      },
      include: { items: true },
    });
  }

  async findFulfillmentById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.fulfillment.findFirst({
      where: { id, companyId },
      include: {
        items: {
          include: { product: true, orderItem: true },
        },
        order: true,
      },
    });
  }

  async listFulfillments(
    companyId: string,
    type?: FulfillmentType,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.fulfillment.findMany({
      where: { companyId, ...(type && { type }) },
      include: { order: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get fulfillment by ID with all relations for posting
   */
  async getFulfillmentForPosting(
    id: string,
    companyId: string,
    tx: Prisma.TransactionClient
  ) {
    return tx.fulfillment.findFirstOrThrow({
      where: { id, companyId, status: 'DRAFT' },
      include: {
        items: { include: { product: true, orderItem: true } },
        order: true,
      },
    });
  }

  /**
   * Snapshot COGS on fulfillment item (for shipments)
   */
  async snapshotCostOnItem(
    itemId: string,
    cost: Prisma.Decimal,
    tx: Prisma.TransactionClient
  ) {
    return tx.fulfillmentItem.update({
      where: { id: itemId },
      data: { costSnapshot: cost },
    });
  }

  /**
   * Update fulfillment status to POSTED
   */
  async postFulfillment(id: string, tx: Prisma.TransactionClient) {
    return tx.fulfillment.update({
      where: { id },
      data: { status: 'POSTED' },
      include: {
        items: { include: { product: true, orderItem: true } },
      },
    });
  }

  async countInvoicesForOrder(
    orderId: string,
    companyId: string,
    type: InvoiceType,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const db = tx || prisma;
    return db.invoice.count({
      where: {
        companyId,
        orderId,
        type,
        status: { not: 'VOID' },
      },
    });
  }

  async voidFulfillment(id: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.fulfillment.update({
      where: { id },
      data: { status: 'VOIDED' },
      include: {
        items: { include: { product: true, orderItem: true } },
        order: true,
      },
    });
  }
}
