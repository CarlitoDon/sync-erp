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
  private repository = new InventoryRepository();
  private productService = new ProductService();
  private _purchaseOrderService: POServiceType | null = null;
  private _salesOrderService: SOServiceType | null = null;
  private journalService = new JournalService();

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

    // Policy: Order must be CONFIRMED or PARTIALLY_RECEIVED/PARTIALLY_SHIPPED
    const allowedStatuses: OrderStatus[] = [
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
              type: 'BILL',
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
}
