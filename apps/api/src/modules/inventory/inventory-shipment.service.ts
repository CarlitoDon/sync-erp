import {
  prisma,
  MovementType,
  Prisma,
  AuditLogAction,
  EntityType,
  FulfillmentType,
  DocumentStatus,
  OrderStatus,
  InvoiceType,
} from '@sync-erp/database';
import { InventoryRepository } from './inventory.repository';
import { JournalService } from '../accounting/services/journal.service';
import { ProductService } from '../product/product.service';
import { DomainError } from '@sync-erp/shared';
import { recordAudit } from '../common/audit/audit-log.service';
import type { SalesOrderService as SOServiceType } from '../sales/sales-order.service';
import { InventoryPolicy } from './inventory.policy';

export class InventoryShipmentService {
  private _salesOrderService: SOServiceType | null = null;

  constructor(
    private readonly repository: InventoryRepository,
    private readonly journalService: JournalService,
    private readonly productService: ProductService
  ) {}

  private async getSalesOrderService(): Promise<SOServiceType> {
    if (!this._salesOrderService) {
      const { SalesOrderService } =
        await import('../sales/sales-order.service');
      this._salesOrderService = new SalesOrderService();
    }
    return this._salesOrderService;
  }

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
    const order = await this.repository.findOrderWithItems(
      data.salesOrderId,
      companyId,
      tx
    );
    if (!order) {
      throw new DomainError('Order not found', 404);
    }

    // Policy: Order must be in valid status
    const allowedStatuses: OrderStatus[] = [
      OrderStatus.CONFIRMED,
      OrderStatus.PARTIALLY_SHIPPED,
      OrderStatus.PARTIALLY_RECEIVED, // Maybe? Original code allowed it.
    ];
    if (!allowedStatuses.includes(order.status as OrderStatus)) {
      throw new DomainError(
        `Cannot create Shipment for order in status: ${order.status}`,
        400
      );
    }

    // Get already fulfilled quantities
    const fulfilledMap =
      await this.repository.getFulfilledQuantitiesForOrder(
        data.salesOrderId,
        FulfillmentType.SHIPMENT,
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
            `Cannot ship ${item.quantity} units. Only ${remaining} remaining.`,
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
        orderId: data.salesOrderId,
        type: FulfillmentType.SHIPMENT,
        date: data.date ? new Date(data.date) : new Date(),
        notes: data.notes,
        items: mappedItems,
      },
      tx
    );
  }

  async postShipment(
    companyId: string,
    shipmentId: string,
    tx?: Prisma.TransactionClient,
    userId?: string
  ) {
    const execute = async (t: Prisma.TransactionClient) => {
      const fulfillment =
        await this.repository.getFulfillmentForPosting(
          shipmentId,
          companyId,
          t
        );

      if (fulfillment.type !== FulfillmentType.SHIPMENT) {
        throw new DomainError('Fulfillment is not a Shipment', 400);
      }

      // Process each item - stock movements + validation
      for (const item of fulfillment.items) {
        const qty = Number(item.quantity);

        // Shipment: Validate stock, snapshot COGS, then OUT
        InventoryPolicy.ensureSufficientStock(
          item.product.name,
          item.product.stockQty,
          qty
        );

        await this.repository.snapshotCostOnItem(
          item.id,
          item.product.averageCost,
          t
        );

        await this.repository.createStockMovement(
          {
            companyId,
            productId: item.productId,
            orderId: fulfillment.orderId,
            fulfillmentId: fulfillment.id,
            type: MovementType.OUT,
            quantity: qty,
            reference: `SHP:${fulfillment.number}`,
          },
          t
        );
      }

      // Update fulfillment status to POSTED
      const posted = await this.repository.postFulfillment(
        shipmentId,
        t
      );

      // Calculate value for journal entry
      const totalValue = fulfillment.items.reduce((sum, item) => {
        const unitValue = Number(item.product.averageCost);
        return sum + Number(item.quantity) * unitValue;
      }, 0);

      // Post journal
      if (totalValue > 0) {
        await this.journalService.postShipment(
          companyId,
          `SHP:${fulfillment.number}`,
          totalValue,
          t
        );
      }

      // Audit log
      if (userId) {
        await recordAudit({
          companyId,
          actorId: userId,
          action: AuditLogAction.SHIPMENT_CREATED,
          entityType: EntityType.SHIPMENT,
          entityId: shipmentId,
          businessDate: new Date(),
          payloadSnapshot: { number: fulfillment.number, totalValue },
        });
      }

      // Recalculate order status
      const soService = await this.getSalesOrderService();
      await soService.recalculateStatus(
        fulfillment.orderId,
        companyId,
        t
      );

      return posted;
    };

    if (tx) return execute(tx);
    return prisma.$transaction(execute);
  }

  async voidShipment(
    companyId: string,
    shipmentId: string,
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
        shipmentId,
        companyId,
        t
      );

      if (!fulfillment) {
        throw new DomainError('Shipment not found', 404);
      }

      if (fulfillment.type !== FulfillmentType.SHIPMENT) {
        throw new DomainError('Document is not a Shipment', 400);
      }

      if (fulfillment.status !== DocumentStatus.POSTED) {
        throw new DomainError(
          `Cannot void Shipment in status: ${fulfillment.status}`,
          400
        );
      }

      // Check no invoice exists linked to this Shipment
      const invoiceCount =
        await this.repository.countInvoicesForFulfillment(
          fulfillment.id,
          companyId,
          InvoiceType.INVOICE,
          t
        );
      if (invoiceCount > 0) {
        throw new DomainError(
          `Cannot void: An INVOICE exists linked to this Shipment. Void it first.`,
          400
        );
      }

      // Calculate value for reversal journal
      const totalValue = fulfillment.items.reduce((sum, item) => {
        const unitValue = Number(item.costSnapshot || 0);
        return sum + Number(item.quantity) * unitValue;
      }, 0);

      // Rollback stock
      for (const item of fulfillment.items) {
        const qty = Number(item.quantity);
        // Reverse OUT (so increment stock)
        await this.productService.updateStock(item.productId, qty, t);
      }

      // Reversal journal
      if (totalValue > 0) {
        await this.journalService.postShipmentReversal(
          companyId,
          `VOID SHP:${fulfillment.number}`,
          totalValue,
          t
        );
      }

      // Update status to VOIDED
      const voided = await this.repository.voidFulfillment(
        shipmentId,
        t
      );

      // Recalculate order status
      const soService = await this.getSalesOrderService();
      await soService.recalculateStatus(
        fulfillment.orderId,
        companyId,
        t
      );

      // Audit
      if (userId) {
        await recordAudit({
          companyId,
          actorId: userId,
          action: AuditLogAction.SHIPMENT_VOIDED,
          entityType: EntityType.SHIPMENT,
          entityId: shipmentId,
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

  async listShipments(companyId: string) {
    return this.repository.listFulfillments(
      companyId,
      FulfillmentType.SHIPMENT
    );
  }

  async getShipment(companyId: string, shipmentId: string) {
    return this.repository.findFulfillmentById(shipmentId, companyId);
  }

  async deleteShipment(
    companyId: string,
    shipmentId: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const fulfillment = await this.repository.findFulfillmentById(
      shipmentId,
      companyId,
      db
    );

    if (!fulfillment) {
      throw new DomainError('Shipment not found', 404);
    }

    if (fulfillment.type !== FulfillmentType.SHIPMENT) {
      throw new DomainError('Document is not a Shipment', 400);
    }

    if (fulfillment.status !== DocumentStatus.DRAFT) {
      throw new DomainError(
        `Cannot delete Shipment in status: ${fulfillment.status}. Only DRAFT can be deleted.`,
        400
      );
    }

    return this.repository.deleteFulfillment(shipmentId, db);
  }
}
