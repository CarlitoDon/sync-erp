import {
  prisma,
  MovementType,
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
import { JournalService } from '../accounting/services/journal.service';
import { DomainError } from '@sync-erp/shared';
import { recordAudit } from '../common/audit/audit-log.service';
import type { PurchaseOrderService as POServiceType } from '../procurement/purchase-order.service';

export class InventoryGRNService {
  private _purchaseOrderService: POServiceType | null = null;

  constructor(
    private readonly repository: InventoryRepository,
    private readonly journalService: JournalService
  ) {}

  // Lazy load to break circular dependency
  private async getPurchaseOrderService(): Promise<POServiceType> {
    if (!this._purchaseOrderService) {
      const { PurchaseOrderService } =
        await import('../procurement/purchase-order.service');
      this._purchaseOrderService = new PurchaseOrderService();
    }
    return this._purchaseOrderService;
  }

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
    const order = await this.repository.findOrderWithItems(
      data.purchaseOrderId,
      companyId,
      tx
    );
    if (!order) {
      throw new DomainError('Order not found', 404);
    }

    // Policy: Order must be in valid status
    const allowedStatuses: OrderStatus[] = [
      OrderStatus.CONFIRMED,
      OrderStatus.PARTIALLY_RECEIVED,
      OrderStatus.PARTIALLY_SHIPPED,
    ];
    if (!allowedStatuses.includes(order.status as OrderStatus)) {
      throw new DomainError(
        `Cannot create GRN for order in status: ${order.status}`,
        400
      );
    }

    // Check DP Bill is paid if DP is required
    const hasDpRequired =
      order.paymentTerms === PaymentTerms.UPFRONT ||
      (order.dpAmount && Number(order.dpAmount) > 0);

    if (hasDpRequired) {
      const paidAmount = Number(order.paidAmount || 0);
      const isPaidViaUpfrontFlow =
        order.paymentStatus === PaymentStatus.PAID_UPFRONT ||
        paidAmount > 0;

      if (!isPaidViaUpfrontFlow) {
        const db = tx || prisma;
        const dpBill = await db.invoice.findFirst({
          where: {
            orderId: data.purchaseOrderId,
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
            'DP Bill must be paid before receiving goods.',
            400
          );
        }
      }
    }

    // Get already fulfilled quantities
    const fulfilledMap =
      await this.repository.getFulfilledQuantitiesForOrder(
        data.purchaseOrderId,
        FulfillmentType.RECEIPT,
        tx
      );

    // Map and validate items
    const mappedItems = data.items.map(
      (item: { productId: string; quantity: number }) => {
        const orderItem = order.items.find(
          (oi) => oi.productId === item.productId
        );
        if (!orderItem) {
          throw new DomainError(
            `Product ${item.productId} not found in order`,
            400
          );
        }

        const alreadyFulfilled =
          fulfilledMap.get(item.productId) || 0;
        const remaining = orderItem.quantity - alreadyFulfilled;
        if (item.quantity > remaining) {
          throw new DomainError(
            `Cannot receive ${item.quantity} units. Only ${remaining} remaining.`,
            422
          );
        }

        return {
          productId: item.productId,
          quantity: item.quantity,
          orderItemId: orderItem.id,
        };
      }
    );

    return this.repository.createFulfillment(
      {
        companyId,
        orderId: data.purchaseOrderId,
        type: FulfillmentType.RECEIPT,
        date: data.date ? new Date(data.date) : new Date(),
        notes: data.notes,
        items: mappedItems,
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
    const execute = async (t: Prisma.TransactionClient) => {
      const fulfillment =
        await this.repository.getFulfillmentForPosting(
          grnId,
          companyId,
          t
        );

      if (fulfillment.type !== FulfillmentType.RECEIPT) {
        throw new DomainError('Fulfillment is not a GRN', 400);
      }

      // Process each item - stock movements
      for (const item of fulfillment.items) {
        const qty = Number(item.quantity);
        // GRN: Stock IN with cost (average cost update)
        const unitCost = Number(item.orderItem.price);
        await this.repository.createStockMovement(
          {
            companyId,
            productId: item.productId,
            orderId: fulfillment.orderId,
            fulfillmentId: fulfillment.id,
            type: MovementType.IN,
            quantity: qty,
            reference: `GRN:${fulfillment.number} PO:${fulfillment.order.orderNumber || fulfillment.orderId}`,
            unitCost,
          },
          t
        );
      }

      // Update fulfillment status to POSTED
      const posted = await this.repository.postFulfillment(grnId, t);

      // Calculate value for journal entry
      const totalValue = fulfillment.items.reduce((sum, item) => {
        const unitValue = Number(item.orderItem.price);
        return sum + Number(item.quantity) * unitValue;
      }, 0);

      // Post journal
      if (totalValue > 0) {
        await this.journalService.postGoodsReceipt(
          companyId,
          `GRN:${fulfillment.number}`,
          totalValue,
          t
        );
      }

      // Audit log
      if (userId) {
        await recordAudit({
          companyId,
          actorId: userId,
          action: AuditLogAction.GRN_POSTED,
          entityType: EntityType.GOODS_RECEIPT,
          entityId: grnId,
          businessDate: new Date(),
          payloadSnapshot: { number: fulfillment.number, totalValue },
        });
      }

      // Recalculate order status
      const poService = await this.getPurchaseOrderService();
      await poService.recalculateStatus(
        fulfillment.orderId,
        companyId,
        t
      );

      return posted;
    };

    if (tx) return execute(tx);
    return prisma.$transaction(execute);
  }

  async voidGRN(
    companyId: string,
    grnId: string,
    reason: string,
    tx?: Prisma.TransactionClient,
    userId?: string,
    userPermissions?: string[]
  ) {
    // Permission check
    const requiredPermission = 'INVENTORY:VOID';
    const normalizedPermissions = userPermissions?.map((p) =>
      p.toUpperCase()
    );
    const hasPermission =
      normalizedPermissions?.includes(requiredPermission) ||
      normalizedPermissions?.includes('INVENTORY:*') ||
      normalizedPermissions?.includes('*:*');

    if (!hasPermission) {
      throw new DomainError(
        `Missing permission: ${requiredPermission}`,
        403
      );
    }

    if (!reason || reason.trim().length === 0) {
      throw new DomainError('Void reason is required', 400);
    }

    const execute = async (t: Prisma.TransactionClient) => {
      const fulfillment = await this.repository.findFulfillmentById(
        grnId,
        companyId,
        t
      );

      if (!fulfillment) {
        throw new DomainError('GRN not found', 404);
      }

      if (fulfillment.type !== FulfillmentType.RECEIPT) {
        throw new DomainError('Document is not a GRN', 400);
      }

      if (fulfillment.status !== DocumentStatus.POSTED) {
        throw new DomainError(
          `Cannot void GRN in status: ${fulfillment.status}`,
          400
        );
      }

      // Check no bill exists linked to this GRN
      const invoiceCount =
        await this.repository.countInvoicesForFulfillment(
          fulfillment.id,
          companyId,
          InvoiceType.BILL,
          t
        );
      if (invoiceCount > 0) {
        throw new DomainError(
          `Cannot void: A BILL exists linked to this GRN. Void it first.`,
          400
        );
      }

      // Calculate value for reversal journal
      const totalValue = fulfillment.items.reduce((sum, item) => {
        const unitValue = Number(item.orderItem.price);
        return sum + Number(item.quantity) * unitValue;
      }, 0);

      // No manual stock rollback needed?
      // WAIT. `InventoryFulfillmentService` did `productService.updateStock` manually in `voidFulfillment`.
      // But `postFulfillment` used `createStockMovement` (which usually triggers triggers or updates stock).
      // Let's check `createStockMovement` in `InventoryRepository`.
      // If `createStockMovement` updates stock, then Void should probably use it/reverse it, or use `productService.updateStock` like before.
      // The original code used `productService.updateStock` (lines 422).
      // I should replicate that logic to be safe.
      // Wait, I need `productService`.

      const { ProductService } =
        await import('../product/product.service');
      const productService = new ProductService(); // Or inject it?
      // I will inject it for consistency.

      for (const item of fulfillment.items) {
        const qty = Number(item.quantity);
        // Reverse IN (so decrement stock)
        await productService.updateStock(item.productId, -qty, t);
      }

      // Reversal journal
      if (totalValue > 0) {
        await this.journalService.postGoodsReceiptReversal(
          companyId,
          `VOID GRN:${fulfillment.number}`,
          totalValue,
          t
        );
      }

      // Update status to VOIDED
      const voided = await this.repository.voidFulfillment(grnId, t);

      // Recalculate order status
      const poService = await this.getPurchaseOrderService();
      await poService.recalculateStatus(
        fulfillment.orderId,
        companyId,
        t
      );

      // Audit
      if (userId) {
        await recordAudit({
          companyId,
          actorId: userId,
          action: AuditLogAction.GRN_VOIDED,
          entityType: EntityType.GOODS_RECEIPT,
          entityId: grnId,
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

  async listGRN(companyId: string, tx?: Prisma.TransactionClient) {
    return this.repository.listFulfillments(
      companyId,
      FulfillmentType.RECEIPT,
      tx
    );
  }

  async getGRN(
    companyId: string,
    grnId: string,
    tx?: Prisma.TransactionClient
  ) {
    return this.repository.findFulfillmentById(grnId, companyId, tx);
  }

  async deleteGRN(
    companyId: string,
    grnId: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const fulfillment = await this.repository.findFulfillmentById(
      grnId,
      companyId,
      db
    );

    if (!fulfillment) {
      throw new DomainError('GRN not found', 404);
    }

    if (fulfillment.type !== FulfillmentType.RECEIPT) {
      throw new DomainError('Document is not a GRN', 400);
    }

    if (fulfillment.status !== DocumentStatus.DRAFT) {
      throw new DomainError(
        `Cannot delete GRN in status: ${fulfillment.status}. Only DRAFT can be deleted.`,
        400
      );
    }

    return this.repository.deleteFulfillment(grnId, db);
  }
}
