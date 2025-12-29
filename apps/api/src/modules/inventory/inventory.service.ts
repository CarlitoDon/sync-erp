import {
  prisma,
  InventoryMovement,
  MovementType,
  BusinessShape,
  Prisma,
  AuditLogAction,
  EntityType,
  FulfillmentType,
  DocumentStatus,
  OrderStatus,
  PaymentTerms,
  PaymentStatus,
  InvoiceType,
  InvoiceStatus,
} from '@sync-erp/database';
import { InventoryRepository } from './inventory.repository';
import { ProductService } from '../product/product.service';
// Lazy-loaded to avoid circular dependency
import type { PurchaseOrderService as POServiceType } from '../procurement/purchase-order.service';
import type { SalesOrderService as SOServiceType } from '../sales/sales-order.service';
import { JournalService } from '../accounting/services/journal.service';
import { InventoryPolicy } from './inventory.policy';
import {
  StockAdjustmentInput,
  DomainError,
  DomainErrorCodes,
} from '@sync-erp/shared';
import { recordAudit } from '../common/audit/audit-log.service';

export class InventoryService {
  private _purchaseOrderService: POServiceType | null = null;
  private _salesOrderService: SOServiceType | null = null;

  constructor(
    private readonly repository: InventoryRepository = new InventoryRepository(),
    private readonly productService: ProductService = new ProductService(),
    private readonly journalService: JournalService = new JournalService()
  ) {}

  // Lazy load to break circular dependency
  private async getPurchaseOrderService(): Promise<POServiceType> {
    if (!this._purchaseOrderService) {
      const { PurchaseOrderService } =
        await import('../procurement/purchase-order.service');
      this._purchaseOrderService = new PurchaseOrderService();
    }
    return this._purchaseOrderService!;
  }

  private async getSalesOrderService(): Promise<SOServiceType> {
    if (!this._salesOrderService) {
      const { SalesOrderService } =
        await import('../sales/sales-order.service');
      this._salesOrderService = new SalesOrderService();
    }
    return this._salesOrderService!;
  }

  // ==========================================
  // Movement Methods
  // ==========================================

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

  async adjustStock(
    companyId: string,
    data: StockAdjustmentInput,
    shape?: BusinessShape,
    configs?: { key: string; value: Prisma.JsonValue }[],
    tx?: Prisma.TransactionClient
  ): Promise<InventoryMovement> {
    if (shape) InventoryPolicy.ensureCanAdjustStock(shape);
    if (configs) InventoryPolicy.ensureInventoryEnabled(configs);

    const isLoss = data.quantity < 0;
    const absQty = Math.abs(data.quantity);

    const product = await this.productService.getById(
      data.productId,
      companyId,
      tx
    );
    if (!product)
      throw new DomainError(
        'Product not found',
        404,
        DomainErrorCodes.PRODUCT_NOT_FOUND
      );

    if (isLoss && product.stockQty < absQty) {
      throw new DomainError(
        `Insufficient stock. Current: ${product.stockQty}, Check: ${absQty}`,
        422,
        DomainErrorCodes.INSUFFICIENT_STOCK
      );
    }

    const db = tx || prisma;
    const movement = await this.repository.createMovement(
      {
        companyId,
        productId: data.productId,
        type: data.quantity > 0 ? MovementType.IN : MovementType.OUT,
        quantity: absQty,
        reference: data.reference || 'Manual adjustment',
      },
      db
    );

    let journalAmount = 0;
    if (!isLoss) {
      await this.productService.updateAverageCost(
        data.productId,
        data.quantity,
        data.costPerUnit,
        tx
      );
      journalAmount = absQty * data.costPerUnit;
    } else {
      await this.productService.updateStock(
        data.productId,
        data.quantity,
        tx
      );
      journalAmount = absQty * Number(product.averageCost);
    }

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

  // ==========================================
  // Unified Fulfillment Methods
  // ==========================================

  async createFulfillment(
    companyId: string,
    data: {
      orderId: string;
      type: FulfillmentType;
      date?: string;
      notes?: string;
      receivedBy?: string;
      items: { productId: string; quantity: number }[];
    },
    tx?: Prisma.TransactionClient
  ) {
    const order = await this.repository.findOrderWithItems(
      data.orderId,
      companyId,
      tx
    );
    if (!order) {
      throw new DomainError('Order not found', 404);
    }

    // Policy: Order must be in valid status for fulfillment type
    // Returns are allowed on COMPLETED/RECEIVED orders
    const isReturnType =
      data.type === FulfillmentType.RETURN ||
      data.type === FulfillmentType.PURCHASE_RETURN;
    const allowedStatuses: OrderStatus[] = isReturnType
      ? [
          OrderStatus.CONFIRMED,
          OrderStatus.PARTIALLY_RECEIVED,
          OrderStatus.PARTIALLY_SHIPPED,
          OrderStatus.COMPLETED,
          OrderStatus.RECEIVED,
          OrderStatus.SHIPPED,
        ]
      : [
          OrderStatus.CONFIRMED,
          OrderStatus.PARTIALLY_RECEIVED,
          OrderStatus.PARTIALLY_SHIPPED,
        ];
    if (!allowedStatuses.includes(order.status as OrderStatus)) {
      throw new DomainError(
        `Cannot create fulfillment for order in status: ${order.status}`,
        400
      );
    }

    // For RECEIPT (GRN): Check DP Bill is paid if DP is required
    if (data.type === FulfillmentType.RECEIPT) {
      const hasDpRequired =
        order.paymentTerms === PaymentTerms.UPFRONT ||
        (order.dpAmount && Number(order.dpAmount) > 0);

      if (hasDpRequired) {
        // Allow if order has received any upfront payment (legacy flow)
        // This supports both full and partial upfront payments
        const paidAmount = Number(order.paidAmount || 0);
        const isPaidViaUpfrontFlow =
          order.paymentStatus === PaymentStatus.PAID_UPFRONT ||
          paidAmount > 0;

        if (!isPaidViaUpfrontFlow) {
          // Check if DP Bill exists and is PAID (new DP Bill flow)
          const db = tx || prisma;
          const dpBill = await db.invoice.findFirst({
            where: {
              orderId: data.orderId,
              companyId,
              type: InvoiceType.BILL,
              notes: { contains: 'Down Payment' },
            },
          });

          if (!dpBill) {
            throw new DomainError(
              'DP Bill not found. Please confirm the order first.',
              400
            );
          }

          if (dpBill.status !== InvoiceStatus.PAID) {
            throw new DomainError(
              'DP Bill must be paid before receiving goods. Please pay the DP Bill first.',
              400
            );
          }
        }
      }
    }

    // Get already fulfilled quantities
    const fulfilledMap =
      await this.repository.getFulfilledQuantitiesForOrder(
        data.orderId,
        data.type,
        tx
      );

    // Map and validate items
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

      const alreadyFulfilled = fulfilledMap.get(item.productId) || 0;
      const remaining = orderItem.quantity - alreadyFulfilled;
      if (item.quantity > remaining) {
        throw new DomainError(
          `Cannot fulfill ${item.quantity} units. Only ${remaining} remaining.`,
          422
        );
      }

      return {
        productId: item.productId,
        quantity: item.quantity,
        orderItemId: orderItem.id,
      };
    });

    return this.repository.createFulfillment(
      {
        companyId,
        orderId: data.orderId,
        type: data.type,
        date: data.date ? new Date(data.date) : new Date(),
        notes: data.notes,
        receivedBy: data.receivedBy,
        items: mappedItems,
      },
      tx
    );
  }

  async postFulfillment(
    companyId: string,
    fulfillmentId: string,
    tx?: Prisma.TransactionClient,
    userId?: string
  ) {
    const execute = async (t: Prisma.TransactionClient) => {
      // 1. Get fulfillment with all relations
      const fulfillment =
        await this.repository.getFulfillmentForPosting(
          fulfillmentId,
          companyId,
          t
        );

      const isReceipt = fulfillment.type === FulfillmentType.RECEIPT;

      // 2. Process each item - stock movements + validation
      for (const item of fulfillment.items) {
        const qty = Number(item.quantity);

        if (isReceipt) {
          // GRN: Stock IN with cost (average cost update)
          const unitCost = Number(item.orderItem.price);
          await this.repository.createStockMovement(
            {
              companyId,
              productId: item.productId,
              type: MovementType.IN,
              quantity: qty,
              reference: `GRN:${fulfillment.number} PO:${fulfillment.order.orderNumber || fulfillment.orderId}`,
              unitCost,
            },
            t
          );
        } else {
          // Shipment: Validate stock, snapshot COGS, then OUT
          InventoryPolicy.ensureSufficientStock(
            item.product.name,
            item.product.stockQty,
            qty
          );

          // Snapshot COGS for FIFO/AVG costing
          await this.repository.snapshotCostOnItem(
            item.id,
            item.product.averageCost,
            t
          );

          await this.repository.createStockMovement(
            {
              companyId,
              productId: item.productId,
              type: MovementType.OUT,
              quantity: qty,
              reference: `SHP:${fulfillment.number}`,
            },
            t
          );
        }
      }

      // 3. Update fulfillment status to POSTED
      const posted = await this.repository.postFulfillment(
        fulfillmentId,
        t
      );

      // 4. Calculate value for journal entry
      const totalValue = fulfillment.items.reduce((sum, item) => {
        const unitValue = isReceipt
          ? Number(item.orderItem.price)
          : Number(item.product.averageCost);
        return sum + Number(item.quantity) * unitValue;
      }, 0);

      // 5. Post journal
      if (totalValue > 0) {
        if (isReceipt) {
          await this.journalService.postGoodsReceipt(
            companyId,
            `GRN:${fulfillment.number}`,
            totalValue,
            t
          );
        } else {
          await this.journalService.postShipment(
            companyId,
            `SHP:${fulfillment.number}`,
            totalValue,
            t
          );
        }
      }

      // 6. Audit log
      if (userId) {
        await recordAudit({
          companyId,
          actorId: userId,
          action: isReceipt
            ? AuditLogAction.GRN_POSTED
            : AuditLogAction.SHIPMENT_CREATED,
          entityType: isReceipt
            ? EntityType.GOODS_RECEIPT
            : EntityType.SHIPMENT,
          entityId: fulfillmentId,
          businessDate: new Date(),
          payloadSnapshot: { number: fulfillment.number, totalValue },
        });
      }

      // 7. Recalculate order status
      if (isReceipt) {
        const poService = await this.getPurchaseOrderService();
        await poService.recalculateStatus(
          fulfillment.orderId,
          companyId,
          t
        );
      } else {
        const soService = await this.getSalesOrderService();
        await soService.recalculateStatus(
          fulfillment.orderId,
          companyId,
          t
        );
      }

      return posted;
    };

    if (tx) return execute(tx);
    return prisma.$transaction(execute);
  }

  async voidFulfillment(
    companyId: string,
    fulfillmentId: string,
    reason: string,
    tx?: Prisma.TransactionClient,
    userId?: string,
    userPermissions?: string[] // FR-026: Granular permissions array
  ) {
    // FR-026: Void Fulfillment requires 'inventory:void' permission
    const requiredPermission = 'inventory:void';
    const hasPermission =
      userPermissions?.includes(requiredPermission) ||
      userPermissions?.includes('inventory:*') ||
      userPermissions?.includes('*:*');

    if (!hasPermission) {
      throw new DomainError(
        `Missing permission: ${requiredPermission}`,
        403
      );
    }

    // FR-024: Reason is mandatory
    if (!reason || reason.trim().length === 0) {
      throw new DomainError('Void reason is required', 400);
    }

    const execute = async (t: Prisma.TransactionClient) => {
      const fulfillment = await this.repository.findFulfillmentById(
        fulfillmentId,
        companyId,
        t
      );

      if (!fulfillment) {
        throw new DomainError('Fulfillment not found', 404);
      }

      if (fulfillment.status !== DocumentStatus.POSTED) {
        throw new DomainError(
          `Cannot void fulfillment in status: ${fulfillment.status}`,
          400
        );
      }

      const isReceipt = fulfillment.type === FulfillmentType.RECEIPT;
      const invoiceType = isReceipt
        ? InvoiceType.BILL
        : InvoiceType.INVOICE;

      // Check no invoice exists
      const invoiceCount =
        await this.repository.countInvoicesForOrder(
          fulfillment.orderId,
          companyId,
          invoiceType,
          t
        );
      if (invoiceCount > 0) {
        throw new DomainError(
          `Cannot void: A ${invoiceType} exists for this order. Void it first.`,
          400
        );
      }

      // Calculate value for reversal journal
      const totalValue = fulfillment.items.reduce((sum, item) => {
        const unitValue = isReceipt
          ? Number(item.orderItem.price)
          : Number(item.costSnapshot || 0);
        return sum + Number(item.quantity) * unitValue;
      }, 0);

      // Rollback stock
      for (const item of fulfillment.items) {
        const qty = Number(item.quantity);
        await this.productService.updateStock(
          item.productId,
          isReceipt ? -qty : qty,
          t
        );
      }

      // Reversal journal
      if (totalValue > 0) {
        if (isReceipt) {
          await this.journalService.postGoodsReceiptReversal(
            companyId,
            `VOID GRN:${fulfillment.number}`,
            totalValue,
            t
          );
        } else {
          await this.journalService.postShipmentReversal(
            companyId,
            `VOID SHP:${fulfillment.number}`,
            totalValue,
            t
          );
        }
      }

      // Update status to VOIDED
      const voided = await this.repository.voidFulfillment(
        fulfillmentId,
        t
      );

      // Recalculate order status
      if (isReceipt) {
        const poService = await this.getPurchaseOrderService();
        await poService.recalculateStatus(
          fulfillment.orderId,
          companyId,
          t
        );
      } else {
        const soService = await this.getSalesOrderService();
        await soService.recalculateStatus(
          fulfillment.orderId,
          companyId,
          t
        );
      }

      // Audit with reason (FR-024)
      if (userId) {
        await recordAudit({
          companyId,
          actorId: userId,
          action: isReceipt
            ? AuditLogAction.GRN_VOIDED
            : AuditLogAction.SHIPMENT_VOIDED,
          entityType: isReceipt
            ? EntityType.GOODS_RECEIPT
            : EntityType.SHIPMENT,
          entityId: fulfillmentId,
          businessDate: new Date(),
          payloadSnapshot: {
            number: fulfillment.number,
            totalValue,
            reason,
          },
        });
      }

      return voided;
    };

    if (tx) return execute(tx);
    return prisma.$transaction(execute);
  }

  async listFulfillments(
    companyId: string,
    type?: FulfillmentType,
    tx?: Prisma.TransactionClient
  ) {
    return this.repository.listFulfillments(companyId, type, tx);
  }

  async getFulfillment(
    companyId: string,
    fulfillmentId: string,
    tx?: Prisma.TransactionClient
  ) {
    return this.repository.findFulfillmentById(
      fulfillmentId,
      companyId,
      tx
    );
  }

  async deleteFulfillment(
    companyId: string,
    fulfillmentId: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const fulfillment = await this.repository.findFulfillmentById(
      fulfillmentId,
      companyId,
      db
    );

    if (!fulfillment) {
      throw new DomainError('Fulfillment not found', 404);
    }

    if (fulfillment.status !== DocumentStatus.DRAFT) {
      throw new DomainError(
        `Cannot delete fulfillment in status: ${fulfillment.status}. Only DRAFT can be deleted.`,
        400
      );
    }

    return this.repository.deleteFulfillment(fulfillmentId, db);
  }

  // ==========================================
  // Legacy GRN Methods (Wrapper for backward compatibility)
  // ==========================================

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
    return this.createFulfillment(
      companyId,
      {
        orderId: data.purchaseOrderId,
        type: FulfillmentType.RECEIPT,
        date: data.date,
        notes: data.notes,
        items: data.items,
      },
      tx
    );
  }

  async postGRN(
    companyId: string,
    grnId: string,
    tx?: Prisma.TransactionClient,
    userId?: string
  ) {
    return this.postFulfillment(companyId, grnId, tx, userId);
  }

  async listGRN(companyId: string) {
    return this.listFulfillments(companyId, FulfillmentType.RECEIPT);
  }

  async getGRN(companyId: string, grnId: string) {
    return this.getFulfillment(companyId, grnId);
  }

  async voidGRN(
    companyId: string,
    grnId: string,
    reason: string,
    tx?: Prisma.TransactionClient,
    userId?: string,
    userPermissions?: string[] // FR-026: Granular RBAC
  ) {
    return this.voidFulfillment(
      companyId,
      grnId,
      reason,
      tx,
      userId,
      userPermissions
    );
  }

  async deleteGRN(
    companyId: string,
    grnId: string,
    tx?: Prisma.TransactionClient
  ) {
    return this.deleteFulfillment(companyId, grnId, tx);
  }

  // ==========================================
  // Legacy Shipment Methods (Wrapper for backward compatibility)
  // ==========================================

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
    return this.createFulfillment(
      companyId,
      {
        orderId: data.salesOrderId,
        type: FulfillmentType.SHIPMENT,
        date: data.date,
        notes: data.notes,
        items: data.items,
      },
      tx
    );
  }

  async postShipment(
    companyId: string,
    shipmentId: string,
    tx?: Prisma.TransactionClient
  ) {
    return this.postFulfillment(companyId, shipmentId, tx);
  }

  async listShipments(companyId: string) {
    return this.listFulfillments(companyId, FulfillmentType.SHIPMENT);
  }

  async getShipment(companyId: string, shipmentId: string) {
    return this.getFulfillment(companyId, shipmentId);
  }

  async voidShipment(
    companyId: string,
    shipmentId: string,
    reason: string,
    tx?: Prisma.TransactionClient,
    userId?: string,
    userPermissions?: string[] // FR-026: Granular RBAC
  ) {
    return this.voidFulfillment(
      companyId,
      shipmentId,
      reason,
      tx,
      userId,
      userPermissions
    );
  }

  async deleteShipment(
    companyId: string,
    shipmentId: string,
    tx?: Prisma.TransactionClient
  ) {
    return this.deleteFulfillment(companyId, shipmentId, tx);
  }

  // ==========================================
  // Sales Return Methods
  // ==========================================

  /**
   * Create a Sales Return fulfillment
   * Returns goods from customer back to inventory
   */
  async createReturn(
    companyId: string,
    data: {
      salesOrderId: string;
      date?: string;
      notes?: string;
      items: { productId: string; quantity: number }[];
    },
    tx?: Prisma.TransactionClient
  ) {
    // Find the original order
    const order = await this.repository.findOrderWithItems(
      data.salesOrderId,
      companyId,
      tx
    );
    if (!order) {
      throw new DomainError('Sales order not found', 404);
    }

    // Order must have been shipped
    const shippedStatuses: OrderStatus[] = [
      OrderStatus.SHIPPED,
      OrderStatus.PARTIALLY_SHIPPED,
      OrderStatus.COMPLETED,
    ];
    if (!shippedStatuses.includes(order.status as OrderStatus)) {
      throw new DomainError(
        `Cannot create return for order in status: ${order.status}. Order must be shipped first.`,
        400
      );
    }

    // Get shipped quantities to validate return doesn't exceed shipped
    const shippedMap =
      await this.repository.getFulfilledQuantitiesForOrder(
        data.salesOrderId,
        FulfillmentType.SHIPMENT,
        tx
      );

    // Get already returned quantities
    const returnedMap =
      await this.repository.getFulfilledQuantitiesForOrder(
        data.salesOrderId,
        FulfillmentType.RETURN,
        tx
      );

    // Map and validate items
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

      const shipped = shippedMap.get(item.productId) || 0;
      const alreadyReturned = returnedMap.get(item.productId) || 0;
      const returnable = shipped - alreadyReturned;

      if (item.quantity > returnable) {
        throw new DomainError(
          `Cannot return ${item.quantity} units. Only ${returnable} available for return (shipped: ${shipped}, already returned: ${alreadyReturned}).`,
          422
        );
      }

      return {
        productId: item.productId,
        quantity: item.quantity,
        orderItemId: orderItem.id,
      };
    });

    return this.repository.createFulfillment(
      {
        companyId,
        orderId: data.salesOrderId,
        type: FulfillmentType.RETURN,
        date: data.date ? new Date(data.date) : new Date(),
        notes:
          data.notes ||
          `Return for order ${order.orderNumber || data.salesOrderId}`,
        items: mappedItems,
      },
      tx
    );
  }

  /**
   * Post a Sales Return fulfillment
   * - Stock IN (reverse shipment)
   * - COGS reversal journal (Dr Inventory, Cr COGS)
   */
  async postReturn(
    companyId: string,
    returnId: string,
    tx?: Prisma.TransactionClient,
    userId?: string
  ) {
    const execute = async (t: Prisma.TransactionClient) => {
      // 1. Get return fulfillment
      let returnDoc;
      try {
        returnDoc = await this.repository.getFulfillmentForPosting(
          returnId,
          companyId,
          t
        );
      } catch (e) {
        throw new DomainError(
          `Return fulfillment not found or not in DRAFT status: ${returnId}`,
          404,
          DomainErrorCodes.NOT_FOUND
        );
      }

      if (returnDoc.type !== FulfillmentType.RETURN) {
        throw new DomainError(
          'Fulfillment is not a RETURN type',
          400
        );
      }

      // 2. Process each item - stock IN with cost snapshot
      let totalCogs = 0;
      for (const item of returnDoc.items) {
        const qty = Number(item.quantity);

        // Get the cost from the original shipment (use orderItem cost or product averageCost)
        const unitCost = Number(
          item.orderItem.cost || item.product.averageCost
        );
        totalCogs += qty * unitCost;

        // Stock IN
        await this.repository.createStockMovement(
          {
            companyId,
            productId: item.productId,
            type: MovementType.IN,
            quantity: qty,
            reference: `RET:${returnDoc.number}`,
            unitCost,
          },
          t
        );

        // Snapshot cost on return item for audit trail
        await this.repository.snapshotCostOnItem(
          item.id,
          item.product.averageCost,
          t
        );
      }

      // 3. Update fulfillment status to POSTED
      const posted = await this.repository.postFulfillment(
        returnId,
        t
      );

      // 4. Post COGS reversal journal (Dr 1400 Inventory, Cr 5000 COGS)
      if (totalCogs > 0) {
        await this.journalService.postSalesReturn(
          companyId,
          `RET:${returnDoc.number}`,
          totalCogs,
          t
        );
      }

      // 5. Audit log
      if (userId) {
        await recordAudit({
          companyId,
          actorId: userId,
          action: AuditLogAction.SHIPMENT_CREATED, // Reuse for now, could add RETURN_POSTED later
          entityType: EntityType.SHIPMENT,
          entityId: returnId,
          businessDate: new Date(),
          payloadSnapshot: {
            number: returnDoc.number,
            totalCogs,
            type: 'RETURN',
          },
        });
      }

      return posted;
    };

    if (tx) return execute(tx);
    try {
      return await prisma.$transaction(execute);
    } catch (error) {
      // Re-throw DomainError properly (Prisma wraps them causing [object Object])
      if (error instanceof DomainError) {
        throw error;
      }
      // If it's a wrapped error with a cause that is DomainError
      const anyError = error as { cause?: unknown };
      if (anyError?.cause instanceof DomainError) {
        throw anyError.cause;
      }
      // Otherwise throw original error
      throw error;
    }
  }

  async listReturns(companyId: string) {
    return this.listFulfillments(companyId, FulfillmentType.RETURN);
  }

  // ==========================================
  // P2P PURCHASE RETURN METHODS
  // Supplier returns - mirrors O2C Sales Return
  // ==========================================

  /**
   * Create a Purchase Return document (PURCHASE_RETURN fulfillment)
   * Returns goods to supplier - decreases stock and reverses GRNI accrual.
   */
  async createPurchaseReturn(
    companyId: string,
    data: {
      purchaseOrderId: string;
      items: { productId: string; quantity: number }[];
      date?: string;
      notes?: string;
    },
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;

    // Validate PO exists and has received items
    const po = await db.order.findFirst({
      where: { id: data.purchaseOrderId, companyId },
      include: { items: true },
    });

    if (!po) {
      throw new DomainError('Purchase Order not found', 404);
    }

    // Get received quantities
    const receivedQtyMap =
      await this.repository.getFulfilledQuantitiesForOrder(
        data.purchaseOrderId,
        FulfillmentType.RECEIPT,
        db
      );

    // Get already returned quantities
    const returnedQtyMap =
      await this.repository.getFulfilledQuantitiesForOrder(
        data.purchaseOrderId,
        FulfillmentType.PURCHASE_RETURN,
        db
      );

    // Validate return quantities
    for (const item of data.items) {
      const received = receivedQtyMap.get(item.productId) ?? 0;
      const alreadyReturned = returnedQtyMap.get(item.productId) ?? 0;
      const returnable = received - alreadyReturned;

      if (item.quantity > returnable) {
        throw new DomainError(
          `Cannot return ${item.quantity} units. Only ${returnable} units available for return.`,
          400
        );
      }
    }

    // Create fulfillment with PURCHASE_RETURN type
    return this.createFulfillment(
      companyId,
      {
        orderId: data.purchaseOrderId,
        type: FulfillmentType.PURCHASE_RETURN,
        date: data.date,
        notes: data.notes || 'Supplier Return',
        items: data.items,
      },
      db
    );
  }

  /**
   * Post a Purchase Return document
   * - Creates OUT inventory movement (decreases stock)
   * - Posts GRNI reversal journal (Dr 2105, Cr 1400)
   * - Updates fulfillment status to POSTED
   */
  async postPurchaseReturn(
    companyId: string,
    returnId: string,
    tx?: Prisma.TransactionClient,
    userId?: string
  ) {
    const execute = async (t: Prisma.TransactionClient) => {
      const fulfillment = await t.fulfillment.findFirst({
        where: {
          id: returnId,
          companyId,
          type: FulfillmentType.PURCHASE_RETURN,
        },
        include: { items: true },
      });

      if (!fulfillment) {
        throw new DomainError('Purchase return not found', 404);
      }

      if (fulfillment.status === DocumentStatus.POSTED) {
        throw new DomainError('Purchase return already posted', 400);
      }

      // Get current stock and costs
      let totalCost = 0;

      for (const item of fulfillment.items) {
        const product = await this.productService.getById(
          item.productId,
          companyId
        );
        if (!product) {
          throw new DomainError(
            `Product ${item.productId} not found`,
            404
          );
        }

        const qty = Number(item.quantity);
        const itemCost = Number(product.averageCost) * qty;
        totalCost += itemCost;

        // Create OUT movement (decrease stock)
        await this.repository.createMovement(
          {
            companyId,
            productId: item.productId,
            type: MovementType.OUT,
            quantity: qty,
            reference: `PRR:${fulfillment.number}`,
          },
          t
        );

        // Update stock
        await t.product.update({
          where: { id: item.productId },
          data: { stockQty: { decrement: qty } },
        });
      }

      // Post GRNI reversal journal (Dr 2105, Cr 1400)
      await this.journalService.postPurchaseReturn(
        companyId,
        `PRR: ${fulfillment.number}`,
        totalCost,
        t
      );

      // Update fulfillment status
      const posted = await t.fulfillment.update({
        where: { id: returnId },
        data: { status: DocumentStatus.POSTED },
      });

      // Audit log
      if (userId) {
        await recordAudit({
          companyId,
          actorId: userId,
          action: AuditLogAction.SHIPMENT_CREATED, // Reuse for now
          entityType: EntityType.SHIPMENT,
          entityId: returnId,
          businessDate: new Date(),
          payloadSnapshot: { type: 'PURCHASE_RETURN', totalCost },
        });
      }

      return posted;
    };

    if (tx) return execute(tx);
    try {
      return await prisma.$transaction(execute);
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      const anyError = error as { cause?: unknown };
      if (anyError?.cause instanceof DomainError) {
        throw anyError.cause;
      }
      throw error;
    }
  }

  async listPurchaseReturns(companyId: string) {
    return this.listFulfillments(
      companyId,
      FulfillmentType.PURCHASE_RETURN
    );
  }
}
