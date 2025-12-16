import {
  prisma,
  InventoryMovement,
  MovementType,
  BusinessShape,
} from '@sync-erp/database';
import { InventoryRepository } from './inventory.repository';
import { ProductService } from '../product/product.service';
import { ProcurementService } from '../procurement/procurement.service';
import { JournalService } from '../accounting/services/journal.service';
import { InventoryPolicy } from './inventory.policy';
import {
  GoodsReceiptInput,
  StockAdjustmentInput,
} from '@sync-erp/shared';

export class InventoryService {
  private repository = new InventoryRepository();
  private productService = new ProductService();
  private procurementService = new ProcurementService();
  private journalService = new JournalService();

  /**
   * Process goods receipt from a purchase order
   * @param companyId - Company ID
   * @param data - Goods receipt input
   * @param shape - Business Shape for Policy check
   */
  async processGoodsReceipt(
    companyId: string,
    data: GoodsReceiptInput,
    shape?: BusinessShape
  ): Promise<InventoryMovement[]> {
    // Policy check FIRST (if shape provided)
    if (shape) {
      InventoryPolicy.ensureCanAdjustStock(shape);
    }

    const order = await this.procurementService.getById(
      data.orderId,
      companyId
    );
    if (!order) {
      throw new Error('Purchase order not found');
    }

    const orderItems = await this.procurementService.getItems(
      data.orderId
    );
    const movements: InventoryMovement[] = [];

    // Create inventory movements for each order item
    for (const item of orderItems) {
      // Create inventory movement
      const movement = await this.repository.createMovement({
        companyId,
        productId: item.productId,
        type: MovementType.IN,
        quantity: item.quantity,
        reference:
          data.reference || `Goods receipt from ${order.orderNumber}`,
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
    await this.procurementService.complete(data.orderId, companyId);

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
    // Note: Assuming PurchaseOrderService or similar handles Sales Orders?
    // The original code used prisma.order.findFirst directly.
    // Ideally we should use SalesOrderService. But SalesOrderService is likely legacy too.
    // For now, I'll access Prisma directly for order details to match original implementation OR delegate to SalesOrderService if available.
    // Original code: prisma.order.findFirst({ where: { id: orderId, companyId }, include: { items: true } })

    // I will check if SalesOrderService exists and has what I need?
    // Or just replicate the logic using prisma here, but that violates logic separation.
    // I'll stick to Prisma direct access for now as per "Type B" service refactoring,
    // waiting for Sales Module refactor to abstract it properly.

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
      const hasStock = await this.productService.checkStock(
        item.productId,
        item.quantity
      );
      if (!hasStock) {
        throw new Error(
          `Insufficient stock for product ${item.productId}`
        );
      }

      // Get product for cost calculation
      const product = await this.productService.getById(
        item.productId,
        companyId
      );
      if (!product)
        throw new Error(`Product ${item.productId} not found`);

      // Create inventory movement (OUT)
      const movement = await this.repository.createMovement({
        companyId,
        productId: item.productId,
        type: MovementType.OUT,
        quantity: item.quantity,
        reference:
          reference || `Shipment for order ${order.orderNumber}`,
      });
      movements.push(movement);

      // Decrease stock
      await this.productService.updateStock(
        item.productId,
        -item.quantity
      );

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
      const product = await this.productService.getById(
        item.productId,
        companyId
      );
      if (!product)
        throw new Error(`Product ${item.productId} not found`);

      // Create inventory movement (IN) - Restocking
      const movement = await this.repository.createMovement({
        companyId,
        productId: item.productId,
        type: MovementType.IN,
        quantity: item.quantity,
        reference:
          reference || `Return for order ${order.orderNumber}`,
      });
      movements.push(movement);

      // Increase Stock
      await this.productService.updateStock(
        item.productId,
        item.quantity
      );

      // Accumulate COGS Reversal value
      totalCogsReversal +=
        Number(product.averageCost) * item.quantity;
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
   * @param companyId - Company ID
   * @param data - Stock adjustment input
   * @param shape - Business Shape for Policy check
   */
  async adjustStock(
    companyId: string,
    data: StockAdjustmentInput,
    shape?: BusinessShape
  ): Promise<InventoryMovement> {
    // Policy check FIRST (if shape provided)
    if (shape) {
      InventoryPolicy.ensureCanAdjustStock(shape);
    }

    const isLoss = data.quantity < 0;
    const absQty = Math.abs(data.quantity);

    // Get current product state
    const product = await this.productService.getById(
      data.productId,
      companyId
    );
    if (!product) throw new Error('Product not found');

    // T012: Enforce Strict Stock Control for Negative Adjustments
    if (isLoss) {
      if (product.stockQty < absQty) {
        throw new Error(
          `Insufficient stock. Current: ${product.stockQty}, Check: ${absQty}`
        );
      }
    }

    const movement = await this.repository.createMovement({
      companyId,
      productId: data.productId,
      type: data.quantity > 0 ? MovementType.IN : MovementType.OUT,
      quantity: absQty,
      reference: data.reference || 'Manual adjustment',
    });

    let journalAmount = 0;

    if (!isLoss) {
      // Gain: Use provided cost per unit (Incoming Value)
      await this.productService.updateAverageCost(
        data.productId,
        data.quantity,
        data.costPerUnit
      );
      journalAmount = absQty * data.costPerUnit;
    } else {
      // Loss: Use current Average Cost (Book Value)
      await this.productService.updateStock(
        data.productId,
        data.quantity
      );
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

  async getMovements(
    companyId: string,
    productId?: string
  ): Promise<InventoryMovement[]> {
    return this.repository.findMovements(companyId, productId);
  }

  async getStockLevels(companyId: string) {
    return this.productService.list(companyId);
  }
}
