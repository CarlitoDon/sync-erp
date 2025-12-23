import {
  Order,
  OrderStatus,
  OrderType,
  Prisma,
  BusinessShape,
  prisma,
  AuditLogAction,
  EntityType,
} from '@sync-erp/database';
import { SalesOrderRepository } from './sales-order.repository';
import { SalesOrderPolicy } from './sales-order.policy';
import { ProductService } from '../product/product.service';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';
import { recordAudit } from '../common/audit/audit-log.service';

// We define input interface if shared doesn't export strict DTO for internal use yet
// Shared exports CreateSalesOrderInput (inferred from schema)
// Interface: item has { productId, quantity, price }
// CreateSalesOrderInput has { type: 'SALES', items: ... }

import { DocumentNumberService } from '../common/services/document-number.service';
// Direct Repository/Service usage to avoid circular dependency
import { InventoryRepository } from '../inventory/inventory.repository';
import { JournalService } from '../accounting/services/journal.service';

export class SalesOrderService {
  private repository = new SalesOrderRepository();
  private productService = new ProductService();
  private documentNumberService = new DocumentNumberService();
  private inventoryRepository = new InventoryRepository();
  private journalService = new JournalService();

  /**
   * Create a new sales order.
   * @param companyId - Company ID
   * @param data - Order data
   * @param shape - Optional BusinessShape for Policy check (physical goods)
   */
  async create(
    companyId: string,
    data: {
      partnerId: string;
      items: { productId: string; quantity: number; price: number }[];
      taxRate?: number;
    },
    shape?: BusinessShape,
    userId?: string
  ): Promise<Order> {
    // Policy check: SERVICE companies cannot sell physical goods
    // Only enforce if shape is provided and items contain physical products
    if (shape && data.items.length > 0) {
      SalesOrderPolicy.ensureCanSellPhysicalGoods(shape);
    }

    // Generate order number
    const orderNumber = await this.documentNumberService.generate(
      companyId,
      'SO'
    );

    // Calculate totals (including tax)
    const subtotal = data.items.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0
    );
    const taxRate = data.taxRate || 0;
    const taxAmount = (subtotal * taxRate) / 100;
    const totalAmount = subtotal + taxAmount;

    // Prepare create data
    const createData: Prisma.OrderUncheckedCreateInput = {
      companyId,
      partnerId: data.partnerId,
      type: OrderType.SALES,
      status: OrderStatus.DRAFT,
      orderNumber,
      totalAmount,
      taxRate: data.taxRate || 0,
      items: {
        create: data.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
      },
    };

    const order = await this.repository.create(createData);

    // Audit Log
    if (userId) {
      await recordAudit({
        companyId,
        actorId: userId,
        action: AuditLogAction.ORDER_CREATED,
        entityType: EntityType.ORDER,
        entityId: order.id,
        businessDate: new Date(),
        payloadSnapshot: createData as Prisma.InputJsonValue,
      });
    }

    return order;
  }

  async getById(id: string, companyId: string) {
    return this.repository.findById(id, companyId);
  }

  async list(companyId: string, status?: string) {
    return this.repository.findAll(companyId, status as OrderStatus);
  }

  async update(
    id: string,
    companyId: string,
    data: Prisma.OrderUpdateInput
  ): Promise<Order> {
    const order = await this.repository.findById(id, companyId);
    if (!order) {
      throw new DomainError(
        'Sales order not found',
        404,
        DomainErrorCodes.ORDER_NOT_FOUND
      );
    }

    SalesOrderPolicy.validateUpdate(
      order.status,
      { orderNumber: data.orderNumber as string | undefined },
      order.orderNumber || ''
    );

    return this.repository.update(id, data);
  }

  async confirm(
    id: string,
    companyId: string,
    userId?: string
  ): Promise<Order> {
    const order = await this.repository.findById(id, companyId);
    if (!order) {
      throw new DomainError(
        'Sales order not found',
        404,
        DomainErrorCodes.ORDER_NOT_FOUND
      );
    }

    SalesOrderPolicy.validateConfirm(order.status);

    // Check stock availability
    for (const item of order.items) {
      const hasStock = await this.productService.checkStock(
        item.productId,
        item.quantity
      );
      if (!hasStock) {
        throw new DomainError(
          `Insufficient stock for product: ${item.product.name}`,
          422,
          DomainErrorCodes.INSUFFICIENT_STOCK
        );
      }
    }

    const updated = await this.repository.updateStatus(
      id,
      OrderStatus.CONFIRMED,
      order.version
    );

    // Audit Log
    if (userId) {
      await recordAudit({
        companyId,
        actorId: userId,
        action: AuditLogAction.ORDER_CONFIRMED,
        entityType: EntityType.ORDER,
        entityId: id,
        businessDate: new Date(),
        payloadSnapshot: {
          prevStatus: order.status,
          newStatus: OrderStatus.CONFIRMED,
        },
      });
    }

    return updated;
  }

  /**
   * Ship/Deliver Order atomically using Prisma transaction.
   * All operations (validate SO + check stock + create shipment + update status + journal) are atomic.
   */
  async ship(
    companyId: string,
    orderId: string,
    reference?: string,
    _shape?: BusinessShape,
    _configs?: { key: string; value: Prisma.JsonValue }[]
  ) {
    return prisma.$transaction(
      async (tx) => {
        // 1. Lock order row for concurrency safety
        await tx.$executeRaw`SELECT 1 FROM "Order" WHERE id = ${orderId} FOR UPDATE`;

        // 2. Validate order exists and is CONFIRMED
        const order = await this.repository.findById(
          orderId,
          companyId,
          tx
        );
        if (!order) {
          throw new DomainError(
            'Sales order not found',
            404,
            DomainErrorCodes.ORDER_NOT_FOUND
          );
        }

        if (order.status !== OrderStatus.CONFIRMED) {
          throw new DomainError(
            'Order must be confirmed before shipping',
            422,
            DomainErrorCodes.ORDER_INVALID_STATE
          );
        }

        // 3. Validate stock availability
        for (const item of order.items) {
          const hasStock = await this.productService.checkStock(
            item.productId,
            item.quantity,
            tx
          );
          if (!hasStock) {
            throw new DomainError(
              `Insufficient stock for product ${item.productId}`,
              422,
              DomainErrorCodes.INSUFFICIENT_STOCK
            );
          }
        }

        // 4. Create Shipment document
        const shipment =
          await this.inventoryRepository.createShipment(
            {
              companyId,
              salesOrderId: orderId,
              date: new Date(),
              notes:
                reference ||
                `Shipment for Order ${order.orderNumber}`,
              items: order.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                salesOrderItemId: item.id,
              })),
            },
            tx
          );

        // 5. Post Shipment (Stock OUT + COGS Snapshot + Status Update)
        const postedShipment =
          await this.inventoryRepository.postShipment(
            shipment.id,
            companyId,
            tx
          );

        // 5b. Update Order Status (Partial/Full Shipped)
        await this.recalculateStatus(orderId, companyId, tx);

        // 6. Calculate COGS for Journal
        let totalCogs = 0;
        for (const item of postedShipment.items) {
          const cost = Number(
            item.costSnapshot || item.product.averageCost || 0
          );
          totalCogs += Number(item.quantity) * cost;
        }

        // 7. Post COGS Journal
        if (totalCogs > 0) {
          await this.journalService.postShipment(
            companyId,
            `SHP:${postedShipment.number}`,
            totalCogs,
            tx
          );
        }

        // Return empty movements array for backward compatibility
        return [];
      },
      { timeout: 60000 }
    );
  }

  async complete(id: string, companyId: string) {
    const order = await this.repository.findById(id, companyId);
    if (!order) {
      throw new Error('Sales order not found');
    }

    if (order.status !== OrderStatus.CONFIRMED) {
      throw new DomainError(
        `Cannot complete order with status: ${order.status}`,
        422,
        DomainErrorCodes.ORDER_INVALID_STATE
      );
    }

    return this.repository.updateStatus(id, OrderStatus.COMPLETED);
  }

  async cancel(
    id: string,
    companyId: string,
    userId?: string
  ): Promise<Order> {
    const order = await this.repository.findById(id, companyId);
    if (!order) {
      throw new DomainError(
        'Sales order not found',
        404,
        DomainErrorCodes.ORDER_NOT_FOUND
      );
    }

    // Count existing Shipments for this SO
    const shipmentCount = await this.repository.countShipments(id);

    SalesOrderPolicy.validateCancel(order.status, shipmentCount);

    const updated = await this.repository.updateStatus(
      id,
      OrderStatus.CANCELLED,
      order.version
    );

    // Audit Log
    if (userId) {
      await recordAudit({
        companyId,
        actorId: userId,
        action: AuditLogAction.ORDER_CANCELLED,
        entityType: EntityType.ORDER,
        entityId: id,
        businessDate: new Date(),
        payloadSnapshot: {
          prevStatus: order.status,
          newStatus: OrderStatus.CANCELLED,
        },
      });
    }

    return updated;
  }

  /**
   * Recalculate SO status based on existing valid (POSTED) Shipments.
   * Mirrors PurchaseOrderService.recalculateStatus
   */
  async recalculateStatus(
    orderId: string,
    companyId: string,
    tx?: Prisma.TransactionClient
  ): Promise<Order> {
    const order = await this.repository.findById(
      orderId,
      companyId,
      tx
    );
    if (!order) {
      throw new DomainError(
        'Sales order not found',
        404,
        DomainErrorCodes.ORDER_NOT_FOUND
      );
    }

    // Don't recalculate if already CANCELLED or DRAFT
    if (
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.DRAFT
    ) {
      return order;
    }

    // Get ordered quantities per product
    const orderItems = order.items;
    const orderedQty = new Map<string, number>();
    for (const item of orderItems) {
      orderedQty.set(item.productId, item.quantity);
    }

    // Get shipped quantities from POSTED Shipments
    const shippedQty = await this.repository.getShippedQuantities(
      orderId,
      tx
    );

    // Calculate total ordered and shipped
    let totalOrdered = 0;
    let totalShipped = 0;
    for (const [productId, qty] of orderedQty) {
      totalOrdered += qty;
      totalShipped += shippedQty.get(productId) || 0;
    }

    // Determine new status
    let newStatus = order.status;
    if (totalShipped === 0) {
      newStatus = OrderStatus.CONFIRMED;
    } else if (totalShipped < totalOrdered) {
      newStatus = OrderStatus.PARTIALLY_SHIPPED;
    } else {
      // Fully shipped
      newStatus = OrderStatus.SHIPPED;
    }

    // If status changed, update it
    if (newStatus !== order.status) {
      return this.repository.updateStatus(
        orderId,
        newStatus,
        undefined,
        tx
      );
    }

    return order;
  }

  /**
   * Get already shipped quantities for a SO
   * Wrapper for repository method to expose to router layer
   */
  async getShippedQuantities(
    orderId: string,
    tx?: Prisma.TransactionClient
  ): Promise<Map<string, number>> {
    return this.repository.getShippedQuantities(orderId, tx);
  }
}
