import { prisma, OrderType, OrderStatus } from '@sync-erp/database';
import type { Order, OrderItem } from '@sync-erp/database';

interface CreateOrderItemInput {
  productId: string;
  quantity: number;
  price: number;
}

interface CreatePurchaseOrderInput {
  partnerId: string;
  items: CreateOrderItemInput[];
  taxRate?: number;
}

export class PurchaseOrderService {
  /**
   * Create a new purchase order
   */
  async create(companyId: string, _userId: string, data: CreatePurchaseOrderInput): Promise<Order> {
    // Generate order number (simple format for MVP)
    const orderCount = await prisma.order.count({
      where: { companyId, type: OrderType.PURCHASE },
    });
    const orderNumber = `PO-${String(orderCount + 1).padStart(5, '0')}`;

    // Calculate totals
    const totalAmount = data.items.reduce((sum, item) => sum + item.quantity * item.price, 0);

    return prisma.order.create({
      data: {
        companyId,
        partnerId: data.partnerId,
        type: OrderType.PURCHASE,
        status: OrderStatus.DRAFT,
        orderNumber,
        totalAmount,
        taxRate: data.taxRate || 0,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
      include: {
        items: { include: { product: true } },
        partner: true,
      },
    });
  }

  /**
   * Get purchase order by ID
   */
  async getById(id: string, companyId: string): Promise<Order | null> {
    return prisma.order.findFirst({
      where: { id, companyId, type: OrderType.PURCHASE },
      include: {
        items: { include: { product: true } },
        partner: true,
      },
    });
  }

  /**
   * List purchase orders
   */
  async list(companyId: string, status?: string): Promise<Order[]> {
    return prisma.order.findMany({
      where: {
        companyId,
        type: OrderType.PURCHASE,
        ...(status && { status: status as OrderStatus }),
      },
      include: {
        items: true,
        partner: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Confirm/Approve a purchase order
   */
  async confirm(id: string, companyId: string): Promise<Order> {
    const order = await this.getById(id, companyId);
    if (!order) {
      throw new Error('Purchase order not found');
    }

    if (order.status !== OrderStatus.DRAFT) {
      throw new Error(`Cannot confirm order with status: ${order.status}`);
    }

    return prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.CONFIRMED,
      },
      include: {
        items: { include: { product: true } },
        partner: true,
      },
    });
  }

  /**
   * Complete a purchase order (after goods receipt)
   */
  async complete(id: string, companyId: string): Promise<Order> {
    const order = await this.getById(id, companyId);
    if (!order) {
      throw new Error('Purchase order not found');
    }

    if (order.status !== OrderStatus.CONFIRMED) {
      throw new Error(`Cannot complete order with status: ${order.status}`);
    }

    return prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.COMPLETED,
      },
      include: {
        items: { include: { product: true } },
        partner: true,
      },
    });
  }

  /**
   * Cancel a purchase order
   */
  async cancel(id: string, companyId: string): Promise<Order> {
    const order = await this.getById(id, companyId);
    if (!order) {
      throw new Error('Purchase order not found');
    }

    if (order.status === OrderStatus.COMPLETED) {
      throw new Error('Cannot cancel a completed order');
    }

    return prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.CANCELLED,
      },
    });
  }

  /**
   * Get order items for goods receipt processing
   */
  async getItems(orderId: string): Promise<OrderItem[]> {
    return prisma.orderItem.findMany({
      where: { orderId },
      include: { product: true },
    });
  }
}
