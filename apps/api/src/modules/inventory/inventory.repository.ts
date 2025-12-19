import {
  Prisma,
  prisma,
  InventoryMovement,
  MovementType,
} from '@sync-erp/database';

export interface StockMovementInput {
  companyId: string;
  productId: string;
  warehouseId?: string;
  type: MovementType;
  quantity: number;
  reference?: string;
  unitCost?: number; // Needed for IN cost averaging
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
    // 1. Create Movement Log
    const movement = await tx.inventoryMovement.create({
      data: {
        companyId: data.companyId,
        productId: data.productId,
        warehouseId: data.warehouseId,
        type: data.type,
        quantity: data.quantity,
        reference: data.reference,
        // date defaults to now()
      },
    });

    // 2. Calculate Stock Delta (IN = +qty, OUT = -qty)
    const delta =
      data.type === MovementType.IN ? data.quantity : -data.quantity;

    // 3. Update Product Stock (and Average Cost if IN)
    // We fetch first to calculate average cost if needed
    // In a real high-concurrency system, we might need locking or DB-side math
    // For this MVP, we use the passed transaction.

    const product = await tx.product.findUniqueOrThrow({
      where: { id: data.productId },
    });

    let newAverageCost = product.averageCost;

    if (
      data.type === MovementType.IN &&
      data.unitCost !== undefined
    ) {
      // Periodic Average Cost Formula:
      // (OldValue + NewValue) / TotalQty
      // But simpler: NewAvg = ((OldQty * OldAvg) + (InQty * InCost)) / (OldQty + InQty)
      const oldQty = product.stockQty; // Should use stock at time? Assuming current
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
  // Legacy Methods (preserved for compatibility)
  // ==========================================

  async createMovement(
    data: Prisma.InventoryMovementUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ): Promise<InventoryMovement> {
    const db = tx || prisma;
    return db.inventoryMovement.create({
      data,
    });
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
      include: {
        product: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Helper to find one movement if needed
  async findById(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<InventoryMovement | null> {
    const db = tx || prisma;
    return db.inventoryMovement.findUnique({
      where: { id },
    });
  }

  /**
   * Count GRN (IN) movements for a specific order.
   * Used to verify goods have been received before creating Bill.
   */
  async countByReferencePatterns(
    companyId: string,
    patterns: string[],
    type: 'IN' | 'OUT' = 'IN',
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
  // Order Query Methods (for Service Layer purity)
  // ==========================================

  async findPurchaseOrderWithItems(
    orderId: string,
    companyId: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.order.findFirst({
      where: { id: orderId, companyId, type: 'PURCHASE' },
      include: { items: true },
    });
  }

  async findSalesOrderWithItems(
    orderId: string,
    companyId: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.order.findFirst({
      where: { id: orderId, companyId, type: 'SALES' },
      include: { items: true },
    });
  }

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
  // GRN Methods (034-grn-fullstack)
  // ==========================================

  async generateGrnNumber(
    companyId: string,
    tx?: Prisma.TransactionClient
  ): Promise<string> {
    const db = tx || prisma;
    const year = new Date().getFullYear();
    const count = await db.goodsReceipt.count({
      where: { companyId },
    });
    return `GRN-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  async createGoodsReceipt(
    data: {
      companyId: string;
      purchaseOrderId: string;
      date: Date;
      notes?: string;
      items: {
        productId: string;
        quantity: number;
        purchaseOrderItemId: string;
      }[];
    },
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const number = await this.generateGrnNumber(data.companyId, tx);

    return db.goodsReceipt.create({
      data: {
        companyId: data.companyId,
        purchaseOrderId: data.purchaseOrderId,
        number,
        date: data.date,
        notes: data.notes,
        status: 'DRAFT',
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            purchaseOrderItemId: item.purchaseOrderItemId,
          })),
        },
      },
      include: { items: true },
    });
  }

  async findGoodsReceiptById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.goodsReceipt.findFirst({
      where: { id, companyId },
      include: {
        items: { include: { product: true } },
        purchaseOrder: true,
      },
    });
  }

  async listGoodsReceipts(
    companyId: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.goodsReceipt.findMany({
      where: { companyId },
      include: { purchaseOrder: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async postGoodsReceipt(
    id: string,
    companyId: string,
    tx: Prisma.TransactionClient
  ) {
    // 1. Fetch GRN with items
    const grn = await tx.goodsReceipt.findFirstOrThrow({
      where: { id, companyId, status: 'DRAFT' },
      include: {
        items: {
          include: { product: true, purchaseOrderItem: true },
        },
        purchaseOrder: true,
      },
    });

    // 2. For each item: Stock IN + Cost Update
    for (const item of grn.items) {
      const unitCost = Number(item.purchaseOrderItem.price);
      await this.createStockMovement(
        {
          companyId,
          productId: item.productId,
          type: MovementType.IN,
          quantity: Number(item.quantity),
          reference: `GRN:${grn.number} PO:${grn.purchaseOrder.orderNumber || grn.purchaseOrderId}`,
          unitCost,
        },
        tx
      );
    }

    // 3. Update GRN Status
    const postedGrn = await tx.goodsReceipt.update({
      where: { id },
      data: { status: 'POSTED' },
      include: {
        items: {
          include: { product: true, purchaseOrderItem: true },
        },
      },
    });

    // 4. Update Purchase Order Status to COMPLETED
    await tx.order.update({
      where: { id: grn.purchaseOrderId },
      data: { status: 'COMPLETED' },
    });

    return postedGrn;
  }

  // ==========================================
  // Shipment Methods (034-grn-fullstack)
  // ==========================================

  async generateShipmentNumber(
    companyId: string,
    tx?: Prisma.TransactionClient
  ): Promise<string> {
    const db = tx || prisma;
    const year = new Date().getFullYear();
    const count = await db.shipment.count({
      where: { companyId },
    });
    return `SHP-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  async createShipment(
    data: {
      companyId: string;
      salesOrderId: string;
      date: Date;
      notes?: string;
      items: {
        productId: string;
        quantity: number;
        salesOrderItemId: string;
      }[];
    },
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const number = await this.generateShipmentNumber(
      data.companyId,
      tx
    );

    return db.shipment.create({
      data: {
        companyId: data.companyId,
        salesOrderId: data.salesOrderId,
        number,
        date: data.date,
        notes: data.notes,
        status: 'DRAFT',
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            salesOrderItemId: item.salesOrderItemId,
          })),
        },
      },
      include: { items: true },
    });
  }

  async findShipmentById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.shipment.findFirst({
      where: { id, companyId },
      include: {
        items: { include: { product: true } },
        salesOrder: true,
      },
    });
  }

  async listShipments(
    companyId: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.shipment.findMany({
      where: { companyId },
      include: { salesOrder: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async postShipment(
    id: string,
    companyId: string,
    tx: Prisma.TransactionClient
  ) {
    // 1. Fetch Shipment with items
    const shipment = await tx.shipment.findFirstOrThrow({
      where: { id, companyId, status: 'DRAFT' },
      include: { items: { include: { product: true } } },
    });

    // 2. For each item: Validate Stock + Stock OUT + Cost Snapshot
    for (const item of shipment.items) {
      const product = item.product;
      const qty = Number(item.quantity);

      // Validate Stock Floor
      if (product.stockQty < qty) {
        throw new Error(
          `Insufficient stock for ${product.name}. Available: ${product.stockQty}, Required: ${qty}`
        );
      }

      // Snapshot COGS
      await tx.shipmentItem.update({
        where: { id: item.id },
        data: { costSnapshot: product.averageCost },
      });

      // Stock OUT
      await this.createStockMovement(
        {
          companyId,
          productId: item.productId,
          type: MovementType.OUT,
          quantity: qty,
          reference: `SHP:${shipment.number}`,
        },
        tx
      );
    }

    // 3. Update Shipment Status
    const postedShipment = await tx.shipment.update({
      where: { id },
      data: { status: 'POSTED' },
      include: {
        items: { include: { product: true } },
      },
    });

    // 4. Update Sales Order Status to COMPLETED
    await tx.order.update({
      where: { id: shipment.salesOrderId },
      data: { status: 'COMPLETED' },
    });

    return postedShipment;
  }
}
