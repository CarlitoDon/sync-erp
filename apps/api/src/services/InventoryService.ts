import { prisma, MovementType } from '@sync-erp/database';
import type { InventoryMovement } from '@sync-erp/database';
import { ProductService } from './ProductService';
import { PurchaseOrderService } from './PurchaseOrderService';
import { JournalService } from './JournalService';

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
  private journalService = new JournalService();

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

    // Calculate total receipt value for Journal
    const totalReceiptValue = orderItems.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0
    );

    if (totalReceiptValue > 0) {
      // T017: Trigger Accrual Journal
      await this.journalService.postGoodsReceipt(
        companyId,
        data.reference || `Goods receipt from ${order.orderNumber}`,
        totalReceiptValue
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
    let totalCogs = 0;

    for (const item of order.items) {
      // Check if stock is sufficient
      const hasStock = await this.productService.checkStock(item.productId, item.quantity);
      if (!hasStock) {
        throw new Error(`Insufficient stock for product ${item.productId}`);
      }

      // Get product for cost calculation
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) throw new Error(`Product ${item.productId} not found`);

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

      // Accumulate COGS
      totalCogs += Number(product.averageCost) * item.quantity;
    }

    // Post COGS Journal
    if (totalCogs > 0) {
      await this.journalService.postShipment(
        companyId,
        reference || `Shipment for order ${order.orderNumber}`,
        totalCogs
      );
    }

    return movements;
  }

  /**
   * Process sales return (stock increase + COGS reversal)
   */
  async processReturn(
    companyId: string,
    orderId: string,
    items: { productId: string; quantity: number }[],
    reference?: string
  ): Promise<InventoryMovement[]> {
    const order = await prisma.order.findFirst({
      where: { id: orderId, companyId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const movements: InventoryMovement[] = [];
    let totalCogsReversal = 0;

    for (const item of items) {
      // Get product for cost calculation
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) throw new Error(`Product ${item.productId} not found`);

      // Create inventory movement (IN) - Restocking
      const movement = await prisma.inventoryMovement.create({
        data: {
          companyId,
          productId: item.productId,
          type: MovementType.IN,
          quantity: item.quantity,
          reference: reference || `Return for order ${order.orderNumber}`,
        },
      });
      movements.push(movement);

      // Increase Stock
      await this.productService.updateStock(item.productId, item.quantity);

      // Accumulate COGS Reversal value
      // Use current Average Cost as best estimate for reversal
      totalCogsReversal += Number(product.averageCost) * item.quantity;
    }

    // Post Reversal Journal
    if (totalCogsReversal > 0) {
      await this.journalService.postSalesReturn(
        companyId,
        reference || `Return for order ${order.orderNumber}`,
        totalCogsReversal
      );
    }

    return movements;
  }

  /**
   * Manual stock adjustment
   */
  async adjustStock(companyId: string, data: StockAdjustmentInput): Promise<InventoryMovement> {
    const isLoss = data.quantity < 0;
    const absQty = Math.abs(data.quantity);

    // Get current product state
    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) throw new Error('Product not found');

    // T012: Enforce Strict Stock Control for Negative Adjustments
    if (isLoss) {
      if (product.stockQty < absQty) {
        throw new Error(`Insufficient stock. Current: ${product.stockQty}, Check: ${absQty}`);
      }
    }

    const movement = await prisma.inventoryMovement.create({
      data: {
        companyId,
        productId: data.productId,
        type: data.quantity > 0 ? MovementType.IN : MovementType.OUT,
        quantity: absQty,
        reference: data.reference || 'Manual adjustment',
      },
    });

    let journalAmount = 0;

    if (!isLoss) {
      // Gain: Use provided cost per unit (Incoming Value)
      await this.productService.updateAverageCost(data.productId, data.quantity, data.costPerUnit);
      journalAmount = absQty * data.costPerUnit;
    } else {
      // Loss: Use current Average Cost (Book Value)
      await this.productService.updateStock(data.productId, data.quantity);
      journalAmount = absQty * Number(product.averageCost);
    }

    // T011: Post Journal Entry
    if (journalAmount > 0) {
      await this.journalService.postAdjustment(
        companyId,
        data.reference || `Adjustment ${movement.id}`,
        journalAmount,
        isLoss
      );
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
