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
    companyId: string
  ): Promise<
    | (Order & {
        items: (OrderItem & { product: Product })[];
        partner: Partner | null;
      })
    | null
  > {
    return prisma.order.findFirst({
      where: { id, companyId, type: OrderType.PURCHASE },
      include: {
        items: { include: { product: true } },
        partner: true,
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
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(
    id: string,
    status: OrderStatus
  ): Promise<Order> {
    return prisma.order.update({
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
    orderId: string
  ): Promise<(OrderItem & { product: Product })[]> {
    return prisma.orderItem.findMany({
      where: { orderId },
      include: { product: true },
    });
  }
}
