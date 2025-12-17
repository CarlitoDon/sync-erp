import {
  prisma,
  InventoryMovement,
  MovementType,
  BusinessShape,
  Prisma,
} from '@sync-erp/database';
import { InventoryRepository } from './inventory.repository';
import { ProductService } from '../product/product.service';
import { ProcurementService } from '../procurement/procurement.service';
import { JournalService } from '../accounting/services/journal.service';
import { InventoryPolicy } from './inventory.policy';
import {
  GoodsReceiptInput,
  StockAdjustmentInput,
  DomainError,
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
    shape?: BusinessShape,
    tx?: Prisma.TransactionClient
  ): Promise<InventoryMovement[]> {
    // Policy check FIRST (if shape provided)
    if (shape) {
      InventoryPolicy.ensureCanAdjustStock(shape);
    }

    // Note: ProcurementService not yet updated for tx injection.
    // Assuming read ops are safe or updated later.
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
      const movement = await this.repository.createMovement(
        {
          companyId,
          productId: item.productId,
          type: MovementType.IN,
          quantity: item.quantity,
          reference:
            data.reference ||
            `Goods receipt from ${order.orderNumber}`,
        },
        tx
      );
      movements.push(movement);

      // Update product stock and average cost
      await this.productService.updateAverageCost(
        item.productId,
        item.quantity,
        Number(item.price),
        tx
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
        totalReceiptValue,
        tx
      );
    }

    // Mark order as completed
    await this.procurementService.complete(data.orderId, companyId);

    return movements;
  }

  /**
   * Process shipment for a sales order
   * @param companyId - Company ID
   * @param orderId - Sales Order ID
   * @param reference - Optional reference
   * @param shape - Business Shape for Policy check
   * @param configs - System Configs for Policy check
   */
  async processShipment(
    companyId: string,
    orderId: string,
    reference?: string,
    shape?: BusinessShape,
    configs?: { key: string; value: Prisma.JsonValue }[],
    tx?: Prisma.TransactionClient
  ): Promise<InventoryMovement[]> {
    const db = tx || prisma;
    // Policy checks
    if (configs) {
      InventoryPolicy.ensureInventoryEnabled(configs);
    }
    if (shape) {
      InventoryPolicy.ensureCanAdjustStock(shape);
    }

    // Note: Assuming PurchaseOrderService or similar handles Sales Orders?
    // The original code used prisma.order.findFirst directly.
    // Ideally we should use SalesOrderService. But SalesOrderService is likely legacy too.
    // For now, I'll access Prisma directly for order details to match original implementation OR delegate to SalesOrderService if available.
    // Original code: prisma.order.findFirst({ where: { id: orderId, companyId }, include: { items: true } })

    // I will check if SalesOrderService exists and has what I need?
    // Or just replicate the logic using prisma here, but that violates logic separation.
    // I'll stick to Prisma direct access for now as per "Type B" service refactoring,
    // waiting for Sales Module refactor to abstract it properly.

    const order = await db.order.findFirst({
      where: { id: orderId, companyId },
      include: { items: true },
    });

    if (!order) {
      throw new DomainError('Order not found', 404);
    }

    const movements: InventoryMovement[] = [];
    let totalCogs = 0;
    const successfulItems: { productId: string; quantity: number }[] =
      [];

    try {
      for (const item of order.items) {
        // Atomic Decrease with Guard (T019)
        // Replaces simple checkStock + updateStock
        await this.productService.decreaseStock(
          item.productId,
          item.quantity,
          tx
        );
        successfulItems.push({
          productId: item.productId,
          quantity: item.quantity,
        });

        // Get product for cost calculation
        const product = await this.productService.getById(
          item.productId,
          companyId,
          tx
        );
        if (!product)
          throw new Error(`Product ${item.productId} not found`);

        // Create inventory movement (OUT)
        const movement = await this.repository.createMovement(
          {
            companyId,
            productId: item.productId,
            type: MovementType.OUT,
            quantity: item.quantity,
            reference:
              reference || `Shipment for order ${order.orderNumber}`,
          },
          tx
        );
        movements.push(movement);

        // Snapshot COGS on OrderItem (T017 Accuracy)
        await db.orderItem.update({
          where: { id: item.id },
          data: { cost: product.averageCost },
        });

        // Accumulate COGS
        totalCogs += Number(product.averageCost) * item.quantity;
      }
    } catch (error) {
      // Manual Rollback on failure (SAGA-like)
      // IF we are in a transaction (tx provided), this manual rollback is superfluous but harmless?
      // Actually, if we use `tx`, rolling back `tx` undoes the decreaseStock.
      // If `tx` is NOT provided (legacy), we need manual rollback.
      // BUT `productService.updateStock` uses `tx` if passed.
      // If `tx` is passed, `updateStock` runs in `tx`.
      // If `tx` fails, `updateStock` also rolls back.
      // So manual compensation inside `tx` is redundant but we keep it for non-tx calls.

      // However, if we throw error, and `tx` rolls back, then `updateStock` logic runs?
      // If `tx` rolls back, calling `updateStock` (in same `tx`?) will fail or be rolled back too.
      // If we call `updateStock` independent of `tx`? No, if we started with `tx`, we must stay in `tx`.

      // Simplified: If `tx` is present, let `tx` handle rollback.
      if (!tx) {
        for (const s of successfulItems) {
          await this.productService.updateStock(
            s.productId,
            s.quantity
          ); // Re-increment
        }
      }
      throw error;
    }

    // Post COGS Journal
    if (totalCogs > 0) {
      await this.journalService.postShipment(
        companyId,
        reference || `Shipment for order ${order.orderNumber}`,
        totalCogs,
        tx
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
    reference?: string,
    tx?: Prisma.TransactionClient
  ): Promise<InventoryMovement[]> {
    const db = tx || prisma;
    const order = await db.order.findFirst({
      where: { id: orderId, companyId },
      include: { items: true },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const movements: InventoryMovement[] = [];
    let totalCogsReversal = 0;

    for (const item of items) {
      // Find original order item to get snapshot cost
      const orderItem = order.items.find(
        (oi) => oi.productId === item.productId
      );

      // Get product for fallback cost
      const product = await this.productService.getById(
        item.productId,
        companyId,
        tx
      );
      if (!product)
        throw new Error(`Product ${item.productId} not found`);

      // Determine Cost Basis: Snapshot -> Current Avg (Fallback)
      const costBasis = orderItem?.cost
        ? Number(orderItem.cost)
        : Number(product.averageCost);

      // Create inventory movement (IN) - Restocking
      const movement = await this.repository.createMovement(
        {
          companyId,
          productId: item.productId,
          type: MovementType.IN,
          quantity: item.quantity,
          reference:
            reference || `Return for order ${order.orderNumber}`,
        },
        tx
      );
      movements.push(movement);

      // Increase Stock
      await this.productService.updateStock(
        item.productId,
        item.quantity,
        tx
      );

      // Accumulate COGS Reversal value
      totalCogsReversal += costBasis * item.quantity;
    }

    // Post Reversal Journal
    if (totalCogsReversal > 0) {
      await this.journalService.postSalesReturn(
        companyId,
        reference || `Return for order ${order.orderNumber}`,
        totalCogsReversal,
        tx
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
    shape?: BusinessShape,
    configs?: { key: string; value: Prisma.JsonValue }[],
    tx?: Prisma.TransactionClient
  ): Promise<InventoryMovement> {
    // Policy check FIRST
    if (shape) {
      InventoryPolicy.ensureCanAdjustStock(shape);
    }
    // Config check
    if (configs) {
      InventoryPolicy.ensureInventoryEnabled(configs);
    }

    const isLoss = data.quantity < 0;
    const absQty = Math.abs(data.quantity);

    // Get current product state
    const product = await this.productService.getById(
      data.productId,
      companyId,
      tx
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

    const movement = await this.repository.createMovement(
      {
        companyId,
        productId: data.productId,
        type: data.quantity > 0 ? MovementType.IN : MovementType.OUT,
        quantity: absQty,
        reference: data.reference || 'Manual adjustment',
      },
      tx
    );

    let journalAmount = 0;

    if (!isLoss) {
      // Gain: Use provided cost per unit (Incoming Value)
      await this.productService.updateAverageCost(
        data.productId,
        data.quantity,
        data.costPerUnit,
        tx
      );
      journalAmount = absQty * data.costPerUnit;
    } else {
      // Loss: Use current Average Cost (Book Value)
      await this.productService.updateStock(
        data.productId,
        data.quantity,
        tx
      );
      journalAmount = absQty * Number(product.averageCost);
    }

    // T011: Post Journal Entry
    if (journalAmount > 0) {
      await this.journalService.postAdjustment(
        companyId,
        data.reference || `Adjustment ${movement.id}`,
        journalAmount,
        isLoss,
        tx
      );
    }

    return movement;
  }

  async getMovements(
    companyId: string,
    productId?: string,
    tx?: Prisma.TransactionClient
  ): Promise<InventoryMovement[]> {
    return this.repository.findMovements(companyId, productId, tx);
  }

  async getStockLevels(
    companyId: string,
    tx?: Prisma.TransactionClient
  ) {
    return this.productService.list(companyId, tx);
  }
}
