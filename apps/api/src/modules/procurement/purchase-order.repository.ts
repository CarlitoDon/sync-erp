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
  FulfillmentType,
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
      _count: { fulfillments: number };
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
        _count: { select: { fulfillments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    expectedVersion?: number,
    tx?: Prisma.TransactionClient
  ): Promise<Order> {
    const db = tx || prisma;

    if (expectedVersion !== undefined) {
      const result = await db.order.updateMany({
        where: { id, version: expectedVersion },
        data: { status, version: { increment: 1 } },
      });

      if (result.count === 0) {
        throw new Error(
          'Concurrency Error: Order has been modified by another process'
        );
      }

      return db.order.findUniqueOrThrow({
        where: { id },
        include: {
          items: { include: { product: true } },
          partner: true,
        },
      });
    }

    return db.order.update({
      where: { id },
      data: { status, version: { increment: 1 } },
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

  async countFulfillments(
    orderId: string,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const db = tx || prisma;
    return db.fulfillment.count({
      where: { orderId, type: FulfillmentType.RECEIPT },
    });
  }

  async countValidFulfillments(
    orderId: string,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const db = tx || prisma;
    return db.fulfillment.count({
      where: {
        orderId,
        type: FulfillmentType.RECEIPT,
        status: { not: 'VOIDED' },
      },
    });
  }

  async getReceivedQuantities(
    orderId: string,
    tx?: Prisma.TransactionClient
  ): Promise<Map<string, number>> {
    const db = tx || prisma;
    const items = await db.fulfillmentItem.findMany({
      where: {
        fulfillment: {
          orderId,
          type: FulfillmentType.RECEIPT,
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
}
