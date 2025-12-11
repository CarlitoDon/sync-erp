import { prisma, OrderType, OrderStatus } from '@sync-erp/database';
import type { Order, OrderItem } from '@sync-erp/database';
import { Decimal } from '@prisma/client/runtime/library';
import { ProductService } from './ProductService';
import { InventoryService } from './InventoryService';

interface CreateOrderItemInput {
  productId: string;
  quantity: number;
  price: number;
}

interface CreateSalesOrderInput {
  partnerId: string;
  items: CreateOrderItemInput[];
  taxRate?: number;
}

export class SalesOrderService {
  private productService = new ProductService();
  private inventoryService = new InventoryService();

  /**
   * Create a new sales order
   */
  async create(companyId: string, _userId: string, data: CreateSalesOrderInput): Promise<Order> {
    // Generate order number
    const orderCount = await prisma.order.count({
      where: { companyId, type: OrderType.SALES },
    });
    const orderNumber = `SO-${String(orderCount + 1).padStart(5, '0')}`;

    // Calculate totals
    const totalAmount = data.items.reduce((sum, item) => sum + item.quantity * item.price, 0);

    return prisma.order.create({
      data: {
        companyId,
        partnerId: data.partnerId,
        type: OrderType.SALES,
        status: OrderStatus.DRAFT,
        orderNumber,
        totalAmount: new Decimal(totalAmount),
        taxRate: new Decimal(data.taxRate || 0),
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: new Decimal(item.price),
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
   * Get sales order by ID
   */
  async getById(id: string, companyId: string): Promise<Order | null> {
    return prisma.order.findFirst({
      where: { id, companyId, type: OrderType.SALES },
      include: {
        items: { include: { product: true } },
        partner: true,
      },
    });
  }

  /**
   * List sales orders
   */
  async list(companyId: string, status?: string): Promise<Order[]> {
    return prisma.order.findMany({
      where: {
        companyId,
        type: OrderType.SALES,
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
   * Confirm sales order - checks stock availability
   */
  async confirm(id: string, companyId: string): Promise<Order> {
    const order = await this.getById(id, companyId);
    if (!order) {
      throw new Error('Sales order not found');
    }

    if (order.status !== OrderStatus.DRAFT) {
      throw new Error(`Cannot confirm order with status: ${order.status}`);
    }

    // Check stock availability for all items
    const items = await prisma.orderItem.findMany({
      where: { orderId: id },
      include: { product: true },
    });

    for (const item of items) {
      const hasStock = await this.productService.checkStock(item.productId, item.quantity);
      if (!hasStock) {
        throw new Error(`Insufficient stock for product: ${item.product.name}`);
      }
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
   * Complete a sales order (after delivery)
   */
  async complete(id: string, companyId: string): Promise<Order> {
    const order = await this.getById(id, companyId);
    if (!order) {
      throw new Error('Sales order not found');
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
   * Cancel a sales order
   */
  async cancel(id: string, companyId: string): Promise<Order> {
    const order = await this.getById(id, companyId);
    if (!order) {
      throw new Error('Sales order not found');
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
   * Get order items
   */
  async getItems(orderId: string): Promise<OrderItem[]> {
    return prisma.orderItem.findMany({
      where: { orderId },
      include: { product: true },
    });
  }

  /**
   * Process a return for an order
   */
  async returnOrder(
    companyId: string,
    orderId: string,
    items: { productId: string; quantity: number }[]
  ): Promise<void> {
    const order = await this.getById(orderId, companyId);
    if (!order) {
      throw new Error('Sales order not found');
    }

    // Call inventory service to handle stock and financial reversal
    await this.inventoryService.processReturn(companyId, orderId, items);
  }
}
