import { Prisma } from '@sync-erp/database';
import {
  Order,
  OrderStatus,
  OrderType,
  BusinessShape,
  AuditLogAction,
  EntityType,
  PaymentStatus,
  PaymentTerms,
  prisma,
  InvoiceStatus,
} from '@sync-erp/database';
import { PurchaseOrderRepository } from './purchase-order.repository';
import { PurchaseOrderPolicy } from './purchase-order.policy';
import { DocumentNumberService } from '../common/services/document-number.service';
import { recordAudit } from '../common/audit/audit-log.service';
import {
  DomainError,
  DomainErrorCodes,
  CreatePurchaseOrderInput,
  TRANSACTION_TIMEOUT_MS,
} from '@sync-erp/shared';
import {
  calculateDpAmount,
  validateAndAuditClose,
} from '../common/utils/order.utils';
import { InventoryService } from '../inventory/inventory.service';

export class PurchaseOrderService {
  constructor(
    private readonly repository: PurchaseOrderRepository = new PurchaseOrderRepository(),
    private readonly documentNumberService: DocumentNumberService = new DocumentNumberService(),
    private readonly inventoryService: InventoryService = new InventoryService()
  ) {}

  /**
   * Create a new purchase order.
   * @param companyId - Company ID
   * @param data - Order data
   * @param shape - Optional BusinessShape for Policy check (physical goods)
   */
  async create(
    companyId: string,
    data: CreatePurchaseOrderInput,
    shape?: BusinessShape,
    userId?: string
  ): Promise<Order> {
    // Validation: Items must not be empty
    if (!data.items || data.items.length === 0) {
      throw new DomainError(
        'Order must have at least one item',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    // Validation: Check each item for valid quantity and price
    for (const item of data.items) {
      if (item.quantity <= 0) {
        throw new DomainError(
          'Item quantity must be positive',
          400,
          DomainErrorCodes.INVALID_INPUT
        );
      }
      if (item.price <= 0) {
        throw new DomainError(
          'Item price must be positive',
          400,
          DomainErrorCodes.INVALID_INPUT
        );
      }
    }

    // Policy check: SERVICE companies cannot purchase physical goods
    // Only enforce if shape is provided and items contain physical products
    if (shape && data.items.length > 0) {
      PurchaseOrderPolicy.ensureCanPurchasePhysicalGoods(shape);
    }

    // Generate order number
    const orderNumber = await this.documentNumberService.generate(
      companyId,
      'PO'
    );

    // Calculate totals (including tax)
    const subtotal = data.items.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0
    );
    // Use safe default 0 if taxRate is undefined
    const taxRate = data.taxRate ?? 0;
    const itemTax = (subtotal * taxRate) / 100;

    // NOTE: If items are tax inclusive/exclusive logic differs, but here simple calc.
    // Assuming simple tax on subtotal.
    const totalAmount = subtotal + itemTax;

    // Prepare create data
    // Feature 036: Set payment terms and initial status
    // Input is already validated and has default 'NET30' via Zod
    const paymentTerms = data.paymentTerms;

    // Explicit check effectively unnecessary if Zod default works, but safe.
    // If Zod default is applied at Router boundary, it's present.
    // If Service called internally with raw object, it might be missing?
    // Service should expect validated input.

    const createData: Prisma.OrderUncheckedCreateInput = {
      companyId,
      partnerId: data.partnerId,
      type: OrderType.PURCHASE,
      status: OrderStatus.DRAFT,
      orderNumber,
      totalAmount,
      taxRate: taxRate,
      paymentTerms: paymentTerms, // Strictly typed from Zod
      // If UPFRONT, set initial paymentStatus to PENDING
      paymentStatus:
        paymentTerms === PaymentTerms.UPFRONT
          ? PaymentStatus.PENDING
          : null,
      paidAmount: 0,
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

    // Audit Log (Optional for creation, but good practice)
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

  async getById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient
  ) {
    const order = await this.repository.findById(id, companyId, tx);
    if (!order) return null;

    // Get received quantities from POSTED GRNs
    const receivedQtyMap =
      await this.repository.getReceivedQuantities(id, tx);

    // Map received quantities to items
    const itemsWithReceived = order.items.map((item) => ({
      ...item,
      receivedQuantity: receivedQtyMap.get(item.productId) || 0,
    }));

    // Compute billing fields - all logic in backend, frontend just renders
    const invoices = order.invoices || [];

    // Find DP Bill (using isDownPayment flag, not notes parsing)
    const dpBill = invoices.find((inv) => inv.isDownPayment);

    // Calculate Total Billed (INCLUDING DP Bills - all bills count)
    // Use `amount` (gross, includes tax) to match order.totalAmount
    // Exclude VOID bills from calculation
    const totalBilled = invoices
      .filter((inv) => inv.status !== InvoiceStatus.VOID)
      .reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

    // Actual DP amount from DP Bill (or fallback to order.dpAmount)
    const actualDpAmount = dpBill
      ? Number(dpBill.amount)
      : order.dpAmount
        ? Number(order.dpAmount)
        : 0;

    // Actual DP percent (calculated from actual DP Bill amount)
    const orderTotal = Number(order.totalAmount);
    const actualDpPercent = dpBill
      ? Math.round((Number(dpBill.amount) / orderTotal) * 100)
      : order.dpPercent
        ? Number(order.dpPercent)
        : 0;

    // Calculate Outstanding (simple: orderTotal - totalBilled)
    const isDpPaid = dpBill?.status === InvoiceStatus.PAID;
    const outstanding = Math.max(0, orderTotal - totalBilled);

    // Return order with computed fields
    return {
      ...order,
      items: itemsWithReceived,
      // Computed billing fields - frontend renders these directly
      computed: {
        totalBilled,
        outstanding,
        actualDpAmount,
        actualDpPercent,
        isDpPaid,
        dpBillId: dpBill?.id || null,
        dpBillStatus: dpBill?.status || null,
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
        'Purchase order not found',
        404,
        DomainErrorCodes.ORDER_NOT_FOUND
      );
    }

    PurchaseOrderPolicy.validateUpdate(
      order.status,
      { orderNumber: data.orderNumber as string | undefined },
      order.orderNumber || ''
    );

    return this.repository.update(id, data);
  }

  async confirm(
    id: string,
    companyId: string,
    userId: string
  ): Promise<Order> {
    const order = await this.repository.findById(id, companyId);
    if (!order) {
      throw new DomainError(
        'Purchase order not found',
        404,
        DomainErrorCodes.ORDER_NOT_FOUND
      );
    }

    PurchaseOrderPolicy.validateConfirm(order.status);

    const updated = await this.repository.updateStatus(
      id,
      OrderStatus.CONFIRMED,
      order.version
    );

    await recordAudit({
      companyId,
      actorId: userId,
      action: AuditLogAction.ORDER_CONFIRMED, // Ensure this enum exists or map to UPDATE
      entityType: EntityType.ORDER,
      entityId: id,
      businessDate: new Date(),
      payloadSnapshot: {
        prevStatus: order.status,
        newStatus: OrderStatus.CONFIRMED,
      },
    });

    // Feature 041: DP Bill is now created manually by user via "Create DP Bill" button
    // This gives user control over when to create the DP Bill

    return updated;
  }

  async complete(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient
  ): Promise<Order> {
    const order = await this.repository.findById(id, companyId, tx);
    if (!order) {
      throw new DomainError(
        'Purchase order not found',
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

    return this.repository.updateStatus(
      id,
      OrderStatus.COMPLETED,
      undefined, // No optimistic lock in Saga (locked by Saga Orchestrator usually) or pass version if needed
      tx
    );
  }

  async cancel(
    id: string,
    companyId: string,
    userId: string
  ): Promise<Order> {
    const order = await this.repository.findById(id, companyId);
    if (!order) {
      throw new DomainError(
        'Purchase order not found',
        404,
        DomainErrorCodes.ORDER_NOT_FOUND
      );
    }

    // Count existing Fulfillments (GRNs) for this PO
    const fulfillmentCount =
      await this.repository.countFulfillments(id);

    PurchaseOrderPolicy.validateCancel(
      order.status,
      fulfillmentCount
    );

    const updated = await this.repository.updateStatus(
      id,
      OrderStatus.CANCELLED,
      order.version
    );

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

    return updated;
  }

  async getItems(orderId: string, tx?: Prisma.TransactionClient) {
    return this.repository.findItems(orderId, tx);
  }

  /**
   * Receive goods atomically using Prisma transaction.
   * All operations (validate PO + create GRN + stock IN + update status) are atomic.
   */
  async receive(
    orderId: string,
    companyId: string,
    reference?: string,
    _shape?: BusinessShape,
    items?: { id: string; quantity: number }[]
  ) {
    return prisma.$transaction(
      async (tx) => {
        // 1. Lock PO row for concurrency safety
        await tx.$executeRaw`SELECT 1 FROM "Order" WHERE id = ${orderId} FOR UPDATE`;

        // 2. Validate PO exists and is not cancelled
        const order = await this.repository.findById(
          orderId,
          companyId,
          tx
        );
        if (!order) {
          throw new DomainError(
            'Purchase order not found',
            404,
            DomainErrorCodes.ORDER_NOT_FOUND
          );
        }

        if (order.status === OrderStatus.CANCELLED) {
          throw new DomainError(
            'Cannot receive goods for a cancelled order',
            422,
            DomainErrorCodes.ORDER_INVALID_STATE
          );
        }

        // Stage 3 Blocker: UPFRONT payment must be complete before receive
        if (order.paymentTerms === PaymentTerms.UPFRONT) {
          if (order.paymentStatus !== PaymentStatus.PAID_UPFRONT) {
            throw new DomainError(
              'Cannot receive goods: Upfront payment required before delivery. Please complete payment first.',
              400,
              DomainErrorCodes.PAYMENT_REQUIRED
            );
          }
        }

        // Phase 1 Guard: Reject Partial Receipt
        if (items && items.length > 0) {
          const poItems = await this.repository.findItems(
            order.id,
            tx
          );
          if (items.length !== poItems.length) {
            throw new DomainError(
              'Partial receipt is disabled in Phase 1',
              400,
              DomainErrorCodes.FEATURE_DISABLED_PHASE_1
            );
          }
          for (const inputItem of items) {
            const poItem = poItems.find((i) => i.id === inputItem.id);
            if (!poItem || inputItem.quantity !== poItem.quantity) {
              throw new DomainError(
                'Partial receipt is disabled in Phase 1',
                400,
                DomainErrorCodes.FEATURE_DISABLED_PHASE_1
              );
            }
          }
        }

        // 3. Create GRN document
        const poItems = await this.repository.findItems(order.id, tx);
        const grn = await this.inventoryService.createGRN(
          companyId,
          {
            purchaseOrderId: orderId,
            notes:
              reference ||
              `Goods receipt for PO ${order.orderNumber}`,
            items: poItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
          },
          tx
        );

        // 4. Post GRN (Stock IN + Cost Update)
        await this.inventoryService.postGRN(companyId, grn.id, tx);

        // 5. Update PO status to COMPLETED
        await this.repository.updateStatus(
          orderId,
          OrderStatus.COMPLETED,
          undefined, // No optimistic lock version
          tx
        );

        // Return empty movements array for backward compatibility
        return [];
      },
      { timeout: TRANSACTION_TIMEOUT_MS }
    );
  }

  /**
   * Recalculate PO status based on existing valid (POSTED) GRNs.
   * Compares received quantities to ordered quantities per line item.
   *
   * Status logic:
   * - If total received = 0 → CONFIRMED
   * - If 0 < received < ordered → PARTIALLY_RECEIVED
   * - If received >= ordered → RECEIVED (or COMPLETED if Bill exists)
   *
   * Used after posting/voiding a GRN to update PO status.
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
        'Purchase order not found',
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

    // Get received quantities from POSTED GRNs
    const receivedQty = await this.repository.getReceivedQuantities(
      orderId,
      tx
    );

    // Calculate total ordered and received
    let totalOrdered = 0;
    let totalReceived = 0;
    for (const [productId, qty] of orderedQty) {
      totalOrdered += qty;
      totalReceived += receivedQty.get(productId) || 0;
    }

    // Determine new status
    let newStatus = order.status;
    if (totalReceived === 0) {
      newStatus = OrderStatus.CONFIRMED;
    } else if (totalReceived < totalOrdered) {
      // Partial receiving
      newStatus = OrderStatus.PARTIALLY_RECEIVED;
    } else {
      // Fully received
      newStatus = OrderStatus.RECEIVED;
    }

    // If status changed, update it
    if (newStatus !== order.status) {
      return this.repository.updateStatus(
        orderId,
        newStatus,
        undefined, // No optimistic lock in transaction context
        tx
      );
    }

    return order;
  }

  /**
   * Get already received quantities for a PO
   * Wrapper for repository method to expose to router layer
   */
  async getReceivedQuantities(
    orderId: string,
    tx?: Prisma.TransactionClient
  ): Promise<Map<string, number>> {
    return this.repository.getReceivedQuantities(orderId, tx);
  }

  /**
   * Explicitly close a Purchase Order even if partially received (Gap 6).
   * This transitions the PO to RECEIVED status regardless of remaining quantities.
   * Useful when supplier cannot fulfill remaining quantities or order is abandoned.
   *
   * Policy: Only CONFIRMED or PARTIALLY_RECEIVED POs can be closed.
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
      orderName: 'Purchase Order',
      allowedStatuses: [
        OrderStatus.CONFIRMED,
        OrderStatus.PARTIALLY_RECEIVED,
      ],
    });

    // Transition to COMPLETED status
    return this.repository.updateStatus(
      id,
      OrderStatus.COMPLETED,
      undefined,
      undefined
    );
  }

  /**
   * Process a Purchase Return (partial or full)
   * Creates a PURCHASE_RETURN fulfillment, decreases stock, and posts GRNI reversal journal.
   * Mirrors SalesOrderService.returnOrder for O2C parity.
   *
   * @param companyId - Company ID
   * @param orderId - Purchase Order ID
   * @param items - Array of items to return with productId and quantity
   * @param userId - Optional user ID for audit
   * @returns Created return fulfillment
   */
  async returnToPo(
    companyId: string,
    orderId: string,
    items: { productId: string; quantity: number }[],
    userId?: string
  ) {
    // Create purchase return fulfillment
    const returnDoc =
      await this.inventoryService.createPurchaseReturn(companyId, {
        purchaseOrderId: orderId,
        items,
      });

    // Post the return (stock OUT + GRNI reversal journal)
    const posted = await this.inventoryService.postPurchaseReturn(
      companyId,
      returnDoc.id,
      undefined,
      userId
    );

    return posted;
  }
}
