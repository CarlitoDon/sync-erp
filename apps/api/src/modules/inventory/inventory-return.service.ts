import {
  prisma,
  MovementType,
  Prisma,
  AuditLogAction,
  EntityType,
  FulfillmentType,
  DocumentStatus,
  OrderStatus,
} from '@sync-erp/database';
import { InventoryRepository } from './inventory.repository';
import { JournalService } from '../accounting/services/journal.service';
import { ProductService } from '../product/product.service';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';
import { recordAudit } from '../common/audit/audit-log.service';

export class InventoryReturnService {
  constructor(
    private readonly repository: InventoryRepository,
    private readonly journalService: JournalService,
    private readonly productService: ProductService
  ) {}

  // ==========================================
  // Sales Return Methods
  // ==========================================

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

        const shipped = shippedMap.get(item.productId) || 0;
        const alreadyReturned = returnedMap.get(item.productId) || 0;
        const returnable = shipped - alreadyReturned;

        if (item.quantity > returnable) {
          throw new DomainError(
            `Cannot return ${item.quantity} units. Only ${returnable} available for return.`,
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

  async postReturn(
    companyId: string,
    returnId: string,
    tx?: Prisma.TransactionClient,
    userId?: string
  ) {
    const execute = async (t: Prisma.TransactionClient) => {
      let returnDoc;
      try {
        returnDoc = await this.repository.getFulfillmentForPosting(
          returnId,
          companyId,
          t
        );
      } catch {
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

      let totalCogs = 0;
      for (const item of returnDoc.items) {
        const qty = Number(item.quantity);
        const unitCost = Number(
          item.orderItem.cost || item.product.averageCost
        );
        totalCogs += qty * unitCost;

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

        await this.repository.snapshotCostOnItem(
          item.id,
          item.product.averageCost,
          t
        );
      }

      const posted = await this.repository.postFulfillment(
        returnId,
        t
      );

      if (totalCogs > 0) {
        await this.journalService.postSalesReturn(
          companyId,
          `RET:${returnDoc.number}`,
          totalCogs,
          t
        );
      }

      if (userId) {
        await recordAudit({
          companyId,
          actorId: userId,
          action: AuditLogAction.SHIPMENT_CREATED, // Should be RETURN_CREATED or similar, but reuse existing for now
          entityType: EntityType.SHIPMENT, // Should be RETURN
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

  async listReturns(
    companyId: string,
    tx?: Prisma.TransactionClient
  ) {
    return this.repository.listFulfillments(
      companyId,
      FulfillmentType.RETURN,
      tx
    );
  }

  // ==========================================
  // Purchase Return Methods
  // ==========================================

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

    const po = await db.order.findFirst({
      where: { id: data.purchaseOrderId, companyId },
      include: { items: true },
    });

    if (!po) {
      throw new DomainError('Purchase Order not found', 404);
    }

    const receivedQtyMap =
      await this.repository.getFulfilledQuantitiesForOrder(
        data.purchaseOrderId,
        FulfillmentType.RECEIPT,
        db
      );

    const returnedQtyMap =
      await this.repository.getFulfilledQuantitiesForOrder(
        data.purchaseOrderId,
        FulfillmentType.PURCHASE_RETURN,
        db
      );

    // Map items to calculate logic, but we need mapped items for createFulfillment too
    const mappedItems: {
      productId: string;
      quantity: number;
      orderItemId: string;
    }[] = [];

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

      const orderItem = po.items.find(
        (oi) => oi.productId === item.productId
      );
      if (orderItem) {
        mappedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          orderItemId: orderItem.id,
        });
      }
    }

    return this.repository.createFulfillment(
      {
        companyId,
        orderId: data.purchaseOrderId,
        type: FulfillmentType.PURCHASE_RETURN,
        date: data.date ? new Date(data.date) : new Date(),
        notes: data.notes || 'Supplier Return',
        items: mappedItems,
      },
      db
    );
  }

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

        await t.product.update({
          where: { id: item.productId },
          data: { stockQty: { decrement: qty } },
        });
      }

      await this.journalService.postPurchaseReturn(
        companyId,
        `PRR: ${fulfillment.number}`,
        totalCost,
        t
      );

      const posted = await t.fulfillment.update({
        where: { id: returnId },
        data: { status: DocumentStatus.POSTED },
      });

      if (userId) {
        await recordAudit({
          companyId,
          actorId: userId,
          action: AuditLogAction.SHIPMENT_CREATED, // Reuse
          entityType: EntityType.SHIPMENT, // Reuse
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

  async listPurchaseReturns(
    companyId: string,
    tx?: Prisma.TransactionClient
  ) {
    return this.repository.listFulfillments(
      companyId,
      FulfillmentType.PURCHASE_RETURN,
      tx
    );
  }
}
