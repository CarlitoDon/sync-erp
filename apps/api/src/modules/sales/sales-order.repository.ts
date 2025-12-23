import {
  Prisma,
  prisma,
  Order,
  OrderStatus,
  OrderType,
  OrderItem,
  Product,
  Partner,
  Invoice,
} from '@sync-erp/database';

export class SalesOrderRepository {
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
      where: { id, companyId, type: OrderType.SALES },
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
        shipments: number;
      };
    })[]
  > {
    return prisma.order.findMany({
      where: {
        companyId,
        type: OrderType.SALES,
        ...(status && { status }),
      },
      include: {
        items: { include: { product: true } },
        partner: true,
        invoices: true,
        _count: {
          select: { shipments: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get shipped quantities for a Sales Order (from POSTED Shipments)
   */
  async getShippedQuantities(
    orderId: string,
    tx?: Prisma.TransactionClient
  ): Promise<Map<string, number>> {
    const db = tx || prisma;
    const shipmentItems = await db.shipmentItem.findMany({
      where: {
        shipment: {
          salesOrderId: orderId,
          status: 'POSTED',
        },
      },
      select: { productId: true, quantity: true },
    });

    const shippedMap = new Map<string, number>();
    for (const item of shipmentItems) {
      const current = shippedMap.get(item.productId) || 0;
      shippedMap.set(item.productId, current + Number(item.quantity));
    }
    return shippedMap;
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

    // Standard update (if no version check needed)
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

  async update(
    id: string,
    data: Prisma.OrderUpdateInput
  ): Promise<Order> {
    return prisma.order.update({
      where: { id },
      data,
      include: {
        items: { include: { product: true } },
        partner: true,
      },
    });
  }

  async count(companyId: string): Promise<number> {
    return prisma.order.count({
      where: { companyId, type: OrderType.SALES },
    });
  }

  async findItems(
    orderId: string
  ): Promise<(OrderItem & { product: Product })[]> {
    return prisma.orderItem.findMany({
      where: { orderId },
      include: { product: true },
    });
  }

  /**
   * Count shipments for a Sales Order.
   * Used for cancel validation.
   */
  async countShipments(orderId: string): Promise<number> {
    return prisma.shipment.count({
      where: { salesOrderId: orderId },
    });
  }

  /**
   * Count non-voided Shipments for a Sales Order.
   * Used for recalculating SO status after voiding a Shipment.
   */
  async countValidShipments(
    orderId: string,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const db = tx || prisma;
    return db.shipment.count({
      where: {
        salesOrderId: orderId,
        status: { not: 'VOIDED' },
      },
    });
  }
}
