import { prisma, MovementType } from '@sync-erp/database';
import type { InventoryMovement } from '@sync-erp/database';
import { ProductService } from './ProductService';
import { SalesOrderService } from './SalesOrderService';

interface FulfillmentInput {
  orderId: string;
  reference?: string;
}

export class FulfillmentService {
  private productService = new ProductService();
  private salesOrderService = new SalesOrderService();

  /**
   * Process shipment/delivery for a sales order (decreases stock)
   */
  async processShipment(companyId: string, data: FulfillmentInput): Promise<InventoryMovement[]> {
    const order = await this.salesOrderService.getById(data.orderId, companyId);
    if (!order) {
      throw new Error('Sales order not found');
    }

    if (order.status !== 'CONFIRMED') {
      throw new Error('Order must be confirmed before shipping');
    }

    const orderItems = await this.salesOrderService.getItems(data.orderId);
    const movements: InventoryMovement[] = [];

    // Check stock and create movements
    for (const item of orderItems) {
      const hasStock = await this.productService.checkStock(item.productId, item.quantity);
      if (!hasStock) {
        throw new Error(`Insufficient stock for product ${item.productId}`);
      }

      // Create inventory movement (OUT)
      const movement = await prisma.inventoryMovement.create({
        data: {
          companyId,
          productId: item.productId,
          type: MovementType.OUT,
          quantity: item.quantity,
          reference: data.reference || `Shipment for ${order.orderNumber}`,
        },
      });
      movements.push(movement);

      // Decrease stock
      await this.productService.updateStock(item.productId, -item.quantity);
    }

    // Mark order as completed
    await this.salesOrderService.complete(data.orderId, companyId);

    return movements;
  }

  /**
   * Get delivery history for an order
   */
  async getDeliveryHistory(orderId: string): Promise<InventoryMovement[]> {
    return prisma.inventoryMovement.findMany({
      where: {
        reference: { contains: orderId },
        type: MovementType.OUT,
      },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
