import { Prisma } from '@sync-erp/database';
import {
  Order,
  OrderStatus,
  OrderType,
  BusinessShape,
  prisma,
  AuditLogAction,
  EntityType,
  FulfillmentType,
  PaymentTerms,
  PaymentStatus,
  InvoiceStatus,
} from '@sync-erp/database';
import { SalesOrderRepository } from './sales-order.repository';
import { SalesOrderPolicy } from './sales-order.policy';
import { ProductService } from '../product/product.service';
import {
  DomainError,
  DomainErrorCodes,
  CreateSalesOrderInput,
  TRANSACTION_TIMEOUT_MS,
} from '@sync-erp/shared';
import { recordAudit } from '../common/audit/audit-log.service';
import {
  calculateDpAmount,
  validateAndAuditClose,
} from '../common/utils/order.utils';

// We define input interface if shared doesn't export strict DTO for internal use yet
// Shared exports CreateSalesOrderInput (inferred from schema)
// Interface: item has { productId, quantity, price }
// CreateSalesOrderInput has { type: 'SALES', items: ... }

import { DocumentNumberService } from '../common/services/document-number.service';
// Use InventoryService instead of repository for proper service-to-service call
import { InventoryService } from '../inventory/inventory.service';

export class SalesOrderService {
  constructor(
    private readonly repository: SalesOrderRepository = new SalesOrderRepository(),
    private readonly productService: ProductService = new ProductService(),
    private readonly documentNumberService: DocumentNumberService = new DocumentNumberService(),
    private readonly inventoryService: InventoryService = new InventoryService()
  ) {}

  /**
   * Create a new sales order.
   * @param companyId - Company ID
   * @param data - Order data
   * @param shape - Optional BusinessShape for Policy check (physical goods)
   */
  async create(
    companyId: string,
    data: CreateSalesOrderInput,
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

    // Payment terms handling (Cash Upfront Sales)
    const paymentTerms = data.paymentTerms;

    // Prepare create data
    const createData: Prisma.OrderUncheckedCreateInput = {
      companyId,
      partnerId: data.partnerId,
      type: OrderType.SALES,
      status: OrderStatus.DRAFT,
      orderNumber,
      totalAmount,
      taxRate: data.taxRate || 0,
      paymentTerms: paymentTerms,
      paymentStatus:
        paymentTerms === PaymentTerms.UPFRONT
          ? PaymentStatus.PENDING
          : null,
      // Down Payment: Calculate amounts
      dpPercent: data.dpPercent ?? null,
      dpAmount: calculateDpAmount(
        totalAmount,
        data.dpPercent,
        data.dpAmount
      ),
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
    const order = await this.repository.findById(id, companyId);
    if (!order) return null;

    // Get shipped quantities from POSTED shipments
    const shippedQtyMap =
      await this.repository.getShippedQuantities(id);

    // Map shipped quantities to items
    const itemsWithShipped = order.items.map((item) => ({
      ...item,
      shippedQuantity: shippedQtyMap.get(item.productId) || 0,
    }));

    // Compute billing fields - O2C Optimization (Parity with P2P)
    const invoices = order.invoices || [];

    // Find DP Invoice (using isDownPayment flag)
    const dpInvoice = invoices.find((inv) => inv.isDownPayment);

    // Calculate Total Invoiced (INCLUDING DP Invoices - all invoices count)
    // Exclude VOID invoices from calculation
    const totalInvoiced = invoices
      .filter((inv) => inv.status !== InvoiceStatus.VOID)
      .reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

    // Actual DP amount from DP Invoice (or fallback to order.dpAmount)
    const actualDpAmount = dpInvoice
      ? Number(dpInvoice.amount)
      : order.dpAmount
        ? Number(order.dpAmount)
        : 0;

    // Actual DP percent
    const orderTotal = Number(order.totalAmount);
    const actualDpPercent = dpInvoice
      ? Math.round((Number(dpInvoice.amount) / orderTotal) * 100)
      : order.dpPercent
        ? Number(order.dpPercent)
        : 0;

    // Calculate Outstanding
    const isDpPaid = dpInvoice?.status === InvoiceStatus.PAID;
    const outstanding = Math.max(0, orderTotal - totalInvoiced);

    return {
      ...order,
      items: itemsWithShipped,
      computed: {
        totalInvoiced,
        outstanding,
        actualDpAmount,
        actualDpPercent,
        isDpPaid,
        dpInvoiceId: dpInvoice?.id || null,
        dpInvoiceStatus: dpInvoice?.status || null,
        hasDpRequired:
          order.paymentTerms === PaymentTerms.UPFRONT ||
          actualDpAmount > 0,
      },
    };
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

    // GAP-1 Fix: Auto-create DP Invoice for:
    // 1. UPFRONT payment terms (100% DP)
    // 2. Tempo with DP (partial DP)
    const hasDpRequired =
      order.paymentTerms === PaymentTerms.UPFRONT ||
      (order.dpAmount && Number(order.dpAmount) > 0);

    if (hasDpRequired) {
      // Lazy-load InvoiceService to avoid circular dependency
      const { InvoiceService } =
        await import('../accounting/services/invoice.service');
      const invoiceService = new InvoiceService();
      await invoiceService.createDownPaymentInvoice(companyId, id);
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

        // GAP-2 Fix: UPFRONT payment must be complete before ship
        if (order.paymentTerms === PaymentTerms.UPFRONT) {
          if (order.paymentStatus !== PaymentStatus.PAID_UPFRONT) {
            throw new DomainError(
              'Cannot ship: Upfront payment required before delivery. Please complete payment first.',
              400,
              DomainErrorCodes.PAYMENT_REQUIRED
            );
          }
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

        // 4. Create Fulfillment document (Shipment type) using InventoryService
        const fulfillment =
          await this.inventoryService.createFulfillment(
            companyId,
            {
              orderId,
              type: FulfillmentType.SHIPMENT,
              date: new Date().toISOString(),
              notes:
                reference ||
                `Shipment for Order ${order.orderNumber}`,
              items: order.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
              })),
            },
            tx
          );

        // 5. Post Fulfillment (Stock OUT + COGS Snapshot + Journal + Status Recalc)
        // InventoryService.postFulfillment handles all business logic:
        // - Stock validation & movements
        // - COGS snapshot
        // - Journal posting
        // - Order status recalculation
        await this.inventoryService.postFulfillment(
          companyId,
          fulfillment.id,
          tx
        );

        // Return empty movements array for backward compatibility
        return [];
      },
      { timeout: TRANSACTION_TIMEOUT_MS }
    );
  }

  async complete(id: string, companyId: string) {
    const order = await this.repository.findById(id, companyId);
    if (!order) {
      throw new DomainError(
        'Sales order not found',
        404,
        DomainErrorCodes.ORDER_NOT_FOUND
      );
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

    // Count existing Fulfillments (Shipments) for this SO
    const fulfillmentCount =
      await this.repository.countFulfillments(id);

    SalesOrderPolicy.validateCancel(order.status, fulfillmentCount);

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

  /**
   * GAP-O2C-002: Explicitly close a Sales Order even if partially shipped.
   * This transitions the SO to SHIPPED status regardless of remaining quantities.
   * Useful when customer cancels remaining items or order is abandoned.
   *
   * Policy: Only CONFIRMED or PARTIALLY_SHIPPED SOs can be closed.
   */
  async close(
    id: string,
    companyId: string,
    userId: string,
    reason: string
  ): Promise<Order> {
    const order = await this.getById(id, companyId);

    // Use shared validation and audit logic
    await validateAndAuditClose(order, {
      id,
      companyId,
      userId,
      reason,
      orderName: 'Sales Order',
      allowedStatuses: [
        OrderStatus.CONFIRMED,
        OrderStatus.PARTIALLY_SHIPPED,
      ],
    });

    // Transition to COMPLETED status
    return this.repository.updateStatus(id, OrderStatus.COMPLETED);
  }

  /**
   * Process a Sales Return (partial or full)
   * Creates a RETURN fulfillment, increases stock, and posts COGS reversal journal.
   *
   * @param companyId - Company ID
   * @param orderId - Sales Order ID
   * @param items - Array of items to return with productId and quantity
   * @param userId - Optional user ID for audit
   * @returns Created return fulfillment
   */
  async returnOrder(
    companyId: string,
    orderId: string,
    items: { productId: string; quantity: number }[],
    userId?: string
  ) {
    // 1. Create Return Fulfillment
    const returnDoc = await this.inventoryService.createReturn(
      companyId,
      {
        salesOrderId: orderId,
        items,
      }
    );

    // 2. Post Return (Stock IN + COGS Reversal Journal)
    const posted = await this.inventoryService.postReturn(
      companyId,
      returnDoc.id,
      undefined,
      userId
    );

    return posted;
  }
}
