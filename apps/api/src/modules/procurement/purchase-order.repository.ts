import {
  prisma,
  Order,
  OrderItem,
  OrderType,
  OrderStatus,
  Prisma,
  Product,
  Partner,
  Invoice,
} from '@sync-erp/database';

export class PurchaseOrderRepository {
  async create(
    data: Prisma.OrderUncheckedCreateInput
  ): Promise<Order> {
    return prisma.order.create({
      data,
      include: {
        items: { include: { product: true } },
        partner: true,
      },
    });
  }

  async findById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient
  ): Promise<
    | (Order & {
        items: (OrderItem & { product: Product })[];
        partner: Partner | null;
        invoices: Invoice[];
      })
    | null
  > {
    const db = tx || prisma;
    return db.order.findFirst({
      where: { id, companyId, type: OrderType.PURCHASE },
      include: {
        items: { include: { product: true } },
        partner: true,
        invoices: true,
      },
    });
  }

  async findAll(
    companyId: string,
    status?: OrderStatus
  ): Promise<
    (Order & {
      items: (OrderItem & { product: Product })[];
      partner: Partner | null;
      invoices: Invoice[];
      _count: {
        goodsReceipts: number;
      };
    })[]
  > {
    return prisma.order.findMany({
      where: {
        companyId,
        type: OrderType.PURCHASE,
        ...(status && { status }),
      },
      include: {
        items: { include: { product: true } },
        partner: true,
        invoices: true,
        _count: {
          select: { goodsReceipts: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update status with Optimistic Locking
   */
  async updateStatus(
    id: string,
    status: OrderStatus,
    expectedVersion?: number,
    tx?: Prisma.TransactionClient
  ): Promise<Order> {
    const db = tx || prisma;

    // If expectedVersion is provided, ensuring concurrency safety
    if (expectedVersion !== undefined) {
      const result = await db.order.updateMany({
        where: {
          id,
          version: expectedVersion,
        },
        data: {
          status,
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw new Error(
          'Concurrency Error: Order has been modified by another process'
        );
      }

      // Return the updated record
      return db.order.findUniqueOrThrow({
        where: { id },
        include: {
          items: { include: { product: true } },
          partner: true,
        },
      });
    }

    // Standard update (if no version check needed, though not recommended for critical flows)
    return db.order.update({
      where: { id },
      data: {
        status,
        version: { increment: 1 },
      },
      include: {
        items: { include: { product: true } },
        partner: true,
      },
    });
  }

  async count(companyId: string): Promise<number> {
    return prisma.order.count({
      where: { companyId, type: OrderType.PURCHASE },
    });
  }

  async findItems(
    orderId: string,
    tx?: Prisma.TransactionClient
  ): Promise<(OrderItem & { product: Product })[]> {
    const db = tx || prisma;
    return db.orderItem.findMany({
      where: { orderId },
      include: { product: true },
    });
  }

  async countGoodsReceipts(orderId: string): Promise<number> {
    return prisma.goodsReceipt.count({
      where: { purchaseOrderId: orderId },
    });
  }

  /**
   * Count non-voided GRNs for a Purchase Order.
   * Used for recalculating PO status after voiding a GRN.
   */
  async countValidGoodsReceipts(
    orderId: string,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const db = tx || prisma;
    return db.goodsReceipt.count({
      where: {
        purchaseOrderId: orderId,
        status: { not: 'VOIDED' },
      },
    });
  }

  /**
   * Get total received quantities per product from valid (POSTED) GRNs.
   * Used to determine if PO is PARTIALLY_RECEIVED or fully RECEIVED.
   */
  async getReceivedQuantities(
    orderId: string,
    tx?: Prisma.TransactionClient
  ): Promise<Map<string, number>> {
    const db = tx || prisma;

    // Get all POSTED GRN items for this order
    const grnItems = await db.goodsReceiptItem.findMany({
      where: {
        goodsReceipt: {
          purchaseOrderId: orderId,
          status: 'POSTED',
        },
      },
      select: {
        productId: true,
        quantity: true,
      },
    });

    // Aggregate quantities by productId
    const receivedMap = new Map<string, number>();
    for (const item of grnItems) {
      const current = receivedMap.get(item.productId) || 0;
      receivedMap.set(
        item.productId,
        current + Number(item.quantity)
      );
    }
    return receivedMap;
  }
}
