import {
  prisma,
  InventoryMovement,
  MovementType,
  BusinessShape,
  Prisma,
  AuditLogAction,
  EntityType,
} from '@sync-erp/database';
import { InventoryRepository } from './inventory.repository';
import { ProductService } from '../product/product.service';
import { PurchaseOrderService } from '../procurement/purchase-order.service';
import { JournalService } from '../accounting/services/journal.service';
import { InventoryPolicy } from './inventory.policy';
import {
  GoodsReceiptInput,
  StockAdjustmentInput,
  DomainError,
} from '@sync-erp/shared';
import { recordAudit } from '../common/audit/audit-log.service';

export class InventoryService {
  private repository = new InventoryRepository();
  private productService = new ProductService();
  private purchaseOrderService = new PurchaseOrderService();
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
    const order = await this.purchaseOrderService.getById(
      data.orderId,
      companyId,
      tx
    );
    if (!order) {
      throw new Error('Purchase order not found');
    }

    const orderItems = await this.purchaseOrderService.getItems(
      data.orderId,
      tx
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
    await this.purchaseOrderService.complete(
      data.orderId,
      companyId,
      tx
    );

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
    // Policy checks
    if (configs) {
      InventoryPolicy.ensureInventoryEnabled(configs);
    }
    if (shape) {
      InventoryPolicy.ensureCanAdjustStock(shape);
    }

    // Fetch order via Repository (Service Layer Purity)
    const order = await this.repository.findOrderWithItems(
      orderId,
      companyId,
      tx
    );

    if (!order) {
      throw new DomainError('Order not found', 404);
    }

    const movements: InventoryMovement[] = [];
    let totalCogs = 0;
    const successfulItems: { productId: string; quantity: number }[] =
      [];

    try {
      for (const item of order.items) {
        // Get product for validation and cost calculation
        const product = await this.productService.getById(
          item.productId,
          companyId,
          tx
        );
        if (!product) {
          throw new DomainError(
            `Product ${item.productId} not found`,
            404
          );
        }

        // Policy validation - throws DomainError if insufficient stock
        InventoryPolicy.ensureSufficientStock(
          product.name,
          Number(product.stockQty),
          item.quantity
        );

        // Atomic Decrease with Guard (T019)
        await this.productService.decreaseStock(
          item.productId,
          item.quantity,
          tx
        );
        successfulItems.push({
          productId: item.productId,
          quantity: item.quantity,
        });

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
        await this.repository.updateOrderItemCost(
          item.id,
          product.averageCost,
          tx
        );

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
    // Fetch order via Repository (Service Layer Purity)
    const order = await this.repository.findOrderWithItems(
      orderId,
      companyId,
      tx
    );

    if (!order) {
      throw new DomainError('Order not found', 404);
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

  // ==========================================
  // GRN Methods (034-grn-fullstack)
  // ==========================================

  /**
   * Create a new Goods Receipt Note
   * Policy: Order must be CONFIRMED
   */
  async createGRN(
    companyId: string,
    data: {
      purchaseOrderId: string;
      date?: string;
      notes?: string;
      items: { productId: string; quantity: number }[];
    },
    tx?: Prisma.TransactionClient
  ) {
    // 1. Fetch PO with items via Repository
    const order = await this.repository.findPurchaseOrderWithItems(
      data.purchaseOrderId,
      companyId,
      tx
    );

    if (!order) {
      throw new DomainError('Purchase order not found', 404);
    }

    // 2. Policy: Order must be CONFIRMED
    if (order.status !== 'CONFIRMED') {
      throw new DomainError(
        `Cannot receive goods for order in status: ${order.status}. Order must be CONFIRMED.`,
        400
      );
    }

    // 3. Map input items to include purchaseOrderItemId
    const mappedItems = data.items.map((item) => {
      const orderItem = order.items.find(
        (oi) => oi.productId === item.productId
      );
      if (!orderItem) {
        throw new DomainError(
          `Product ${item.productId} not found in order`,
          400
        );
      }
      return {
        productId: item.productId,
        quantity: item.quantity,
        purchaseOrderItemId: orderItem.id,
      };
    });

    // 4. Create GRN
    return this.repository.createGoodsReceipt(
      {
        companyId,
        purchaseOrderId: data.purchaseOrderId,
        date: data.date ? new Date(data.date) : new Date(),
        notes: data.notes,
        items: mappedItems,
      },
      tx
    );
  }

  /**
   * Post a Goods Receipt Note (Stock IN + Cost Update)
   * @param companyId - Company ID
   * @param grnId - GRN ID to post
   * @param tx - Optional transaction client
   * @param userId - Optional user ID for audit logging
   */
  async postGRN(
    companyId: string,
    grnId: string,
    tx?: Prisma.TransactionClient,
    userId?: string
  ) {
    const execute = async (t: Prisma.TransactionClient) => {
      // 1. Post to Stock (and get updated GRN with items)
      const postedGrn = await this.repository.postGoodsReceipt(
        grnId,
        companyId,
        t
      );

      // 2. Calculate Value
      const totalValue = postedGrn.items.reduce(
        (sum, item) =>
          sum +
          Number(item.quantity) *
            Number(item.purchaseOrderItem.price),
        0
      );

      // 3. Post Accrual Journal (if value > 0)
      if (totalValue > 0) {
        await this.journalService.postGoodsReceipt(
          companyId,
          `GRN:${postedGrn.number}`,
          totalValue,
          t
        );
      }

      // 4. Record Audit Log (if userId provided)
      if (userId) {
        await recordAudit({
          companyId,
          actorId: userId,
          action: AuditLogAction.GRN_POSTED,
          entityType: EntityType.GOODS_RECEIPT,
          entityId: grnId,
          businessDate: new Date(),
          payloadSnapshot: {
            grnNumber: postedGrn.number,
            totalValue,
          },
        });
      }

      return postedGrn;
    };

    if (tx) {
      return execute(tx);
    }
    return prisma.$transaction(execute);
  }

  async listGRN(companyId: string) {
    return this.repository.listGoodsReceipts(companyId);
  }

  async getGRN(companyId: string, grnId: string) {
    return this.repository.findGoodsReceiptById(grnId, companyId);
  }

  /**
   * Void a Goods Receipt Note
   * Policy: GRN must be POSTED and no Bill exists for the linked PO
   * Effect: Rollback stock, reverse journal, update PO status
   *
   * @param companyId - Company ID
   * @param grnId - GRN ID to void
   * @param tx - Optional transaction client
   * @param userId - Optional user ID for audit logging
   * @throws DomainError if GRN cannot be voided
   */
  async voidGRN(
    companyId: string,
    grnId: string,
    tx?: Prisma.TransactionClient,
    userId?: string
  ) {
    const execute = async (t: Prisma.TransactionClient) => {
      // 1. Fetch GRN with items
      const grn = await this.repository.findGoodsReceiptById(
        grnId,
        companyId,
        t
      );

      if (!grn) {
        throw new DomainError('Goods Receipt Note not found', 404);
      }

      // 2. Policy: Must be POSTED
      if (grn.status !== 'POSTED') {
        throw new DomainError(
          `Cannot void GRN in status: ${grn.status}. Only POSTED GRNs can be voided.`,
          400
        );
      }

      // 3. Policy: Check no Bill exists for this PO
      const billCount = await this.repository.countBillsForOrder(
        grn.purchaseOrderId,
        companyId,
        t
      );
      if (billCount > 0) {
        throw new DomainError(
          'Cannot void GRN: A Bill has been created for this Purchase Order. Void the Bill first.',
          400
        );
      }

      // 4. Calculate value for journal reversal
      const totalValue = grn.items.reduce(
        (sum, item) =>
          sum +
          Number(item.quantity) *
            Number(item.purchaseOrderItem?.price || 0),
        0
      );

      // 5. Rollback stock for each item
      for (const item of grn.items) {
        // Decrease stock (reverse of GRN post)
        await this.productService.updateStock(
          item.productId,
          -Number(item.quantity),
          t
        );
      }

      // 6. Post Reversal Journal (if value > 0)
      if (totalValue > 0) {
        await this.journalService.postGoodsReceiptReversal(
          companyId,
          `VOID GRN:${grn.number}`,
          totalValue,
          t
        );
      }

      // 7. Update GRN status to VOIDED
      const voidedGrn = await this.repository.voidGoodsReceipt(
        grnId,
        t
      );

      // 8. Update PO status (may need to recalculate received quantities)
      // If all GRNs are voided, revert PO to CONFIRMED
      await this.purchaseOrderService.recalculateStatus(
        grn.purchaseOrderId,
        companyId,
        t
      );

      // 9. Record Audit Log (if userId provided)
      if (userId) {
        await recordAudit({
          companyId,
          actorId: userId,
          action: AuditLogAction.GRN_VOIDED,
          entityType: EntityType.GOODS_RECEIPT,
          entityId: grnId,
          businessDate: new Date(),
          payloadSnapshot: { grnNumber: grn.number, totalValue },
        });
      }

      return voidedGrn;
    };

    if (tx) {
      return execute(tx);
    }
    return prisma.$transaction(execute);
  }

  // ==========================================
  // Shipment Methods (034-grn-fullstack)
  // ==========================================

  /**
   * Create a new Shipment
   * Policy: Order must be CONFIRMED, Stock must be available
   */
  async createShipment(
    companyId: string,
    data: {
      salesOrderId: string;
      date?: string;
      notes?: string;
      items: { productId: string; quantity: number }[];
    },
    tx?: Prisma.TransactionClient
  ) {
    // 1. Fetch SO with items via Repository
    const order = await this.repository.findSalesOrderWithItems(
      data.salesOrderId,
      companyId,
      tx
    );

    if (!order) {
      throw new DomainError('Sales order not found', 404);
    }

    // 2. Policy: Order must be CONFIRMED
    if (order.status !== 'CONFIRMED') {
      throw new DomainError(
        `Cannot ship goods for order in status: ${order.status}. Order must be CONFIRMED.`,
        400
      );
    }

    // 3. Map input items to include salesOrderItemId
    const mappedItems = data.items.map((item) => {
      const orderItem = order.items.find(
        (oi) => oi.productId === item.productId
      );
      if (!orderItem) {
        throw new DomainError(
          `Product ${item.productId} not found in order`,
          400
        );
      }
      return {
        productId: item.productId,
        quantity: item.quantity,
        salesOrderItemId: orderItem.id,
      };
    });

    // 4. Create Shipment
    return this.repository.createShipment(
      {
        companyId,
        salesOrderId: data.salesOrderId,
        date: data.date ? new Date(data.date) : new Date(),
        notes: data.notes,
        items: mappedItems,
      },
      tx
    );
  }

  /**
   * Post a Shipment (Stock OUT + COGS Snapshot)
   */
  async postShipment(
    companyId: string,
    shipmentId: string,
    tx?: Prisma.TransactionClient
  ) {
    const execute = async (t: Prisma.TransactionClient) => {
      // 1. Post to Stock (and get updated Shipment with items and cost snapshots)
      const postedShipment = await this.repository.postShipment(
        shipmentId,
        companyId,
        t
      );

      // 2. Calculate COGS Value
      const totalCogs = postedShipment.items.reduce(
        (sum, item) =>
          sum +
          Number(item.quantity) *
            Number(item.costSnapshot || item.product.averageCost),
        0
      );

      // 3. Post COGS Journal (if value > 0)
      if (totalCogs > 0) {
        await this.journalService.postShipment(
          companyId,
          `SHP:${postedShipment.number}`,
          totalCogs,
          t
        );
      }

      return postedShipment;
    };

    if (tx) {
      return execute(tx);
    }
    return prisma.$transaction(execute);
  }

  async listShipments(companyId: string) {
    return this.repository.listShipments(companyId);
  }

  async getShipment(companyId: string, shipmentId: string) {
    return this.repository.findShipmentById(shipmentId, companyId);
  }
}
