import {
  prisma,
  Order,
  OrderItem,
  OrderType,
  OrderStatus,
  Prisma,
  Product,
  Partner,
} from '@sync-erp/database';

export class ProcurementRepository {
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
  ): Promise<Order[]> {
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
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    tx?: Prisma.TransactionClient
  ): Promise<Order> {
    const db = tx || prisma;
    return db.order.update({
      where: { id },
      data: { status },
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
}
