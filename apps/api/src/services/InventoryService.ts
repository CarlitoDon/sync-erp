import { prisma, MovementType } from '@sync-erp/database';
import type { InventoryMovement } from '@sync-erp/database';
import { ProductService } from './ProductService';
import { PurchaseOrderService } from './PurchaseOrderService';

interface GoodsReceiptInput {
  orderId: string;
  reference?: string;
}

interface StockAdjustmentInput {
  productId: string;
  quantity: number;
  costPerUnit: number;
  reference?: string;
}

export class InventoryService {
  private productService = new ProductService();
  private purchaseOrderService = new PurchaseOrderService();

  /**
   * Process goods receipt from a purchase order
   */
  async processGoodsReceipt(
    companyId: string,
    data: GoodsReceiptInput
  ): Promise<InventoryMovement[]> {
    const order = await this.purchaseOrderService.getById(data.orderId, companyId);
    if (!order) {
      throw new Error('Purchase order not found');
    }

    const orderItems = await this.purchaseOrderService.getItems(data.orderId);
    const movements: InventoryMovement[] = [];

    // Create inventory movements for each order item
    for (const item of orderItems) {
      // Create inventory movement
      const movement = await prisma.inventoryMovement.create({
        data: {
          companyId,
          productId: item.productId,
          type: MovementType.IN,
          quantity: item.quantity,
          reference: data.reference || `Goods receipt from ${order.orderNumber}`,
        },
      });
      movements.push(movement);

      // Update product stock and average cost
      await this.productService.updateAverageCost(
        item.productId,
        item.quantity,
        Number(item.price)
      );
    }

    // Mark order as completed
    await this.purchaseOrderService.complete(data.orderId, companyId);

    return movements;
  }

  /**
   * Process shipment/delivery (stock decrease)
   */
  async processShipment(
    companyId: string,
    orderId: string,
    reference?: string
  ): Promise<InventoryMovement[]> {
    const order = await prisma.order.findFirst({
      where: { id: orderId, companyId },
      include: { items: true },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const movements: InventoryMovement[] = [];

    for (const item of order.items) {
      // Check if stock is sufficient
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
          reference: reference || `Shipment for order ${order.orderNumber}`,
        },
      });
      movements.push(movement);

      // Decrease stock
      await this.productService.updateStock(item.productId, -item.quantity);
    }

    return movements;
  }

  /**
   * Manual stock adjustment
   */
  async adjustStock(companyId: string, data: StockAdjustmentInput): Promise<InventoryMovement> {
    const movement = await prisma.inventoryMovement.create({
      data: {
        companyId,
        productId: data.productId,
        type: data.quantity > 0 ? MovementType.IN : MovementType.OUT,
        quantity: Math.abs(data.quantity),
        reference: data.reference || 'Manual adjustment',
      },
    });

    if (data.quantity > 0) {
      await this.productService.updateAverageCost(data.productId, data.quantity, data.costPerUnit);
    } else {
      await this.productService.updateStock(data.productId, data.quantity);
    }

    return movement;
  }

  /**
   * Get inventory movements for a product
   */
  async getMovements(companyId: string, productId?: string): Promise<InventoryMovement[]> {
    return prisma.inventoryMovement.findMany({
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

  /**
   * Get current stock levels for all products
   */
  async getStockLevels(companyId: string) {
    return prisma.product.findMany({
      where: { companyId },
      select: {
        id: true,
        sku: true,
        name: true,
        stockQty: true,
        averageCost: true,
        price: true,
      },
      orderBy: { name: 'asc' },
    });
  }
}
