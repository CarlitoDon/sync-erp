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

export class SalesRepository {
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
  ): Promise<Order[]> {
    return prisma.order.findMany({
      where: {
        companyId,
        type: OrderType.SALES,
        ...(status && { status }),
      },
      include: {
        items: true,
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
}
