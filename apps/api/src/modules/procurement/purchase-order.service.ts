import {
  Order,
  OrderStatus,
  OrderType,
  Prisma,
  BusinessShape,
  AuditLogAction,
  EntityType,
  prisma,
} from '@sync-erp/database';
import { PurchaseOrderRepository } from './purchase-order.repository';
import { PurchaseOrderPolicy } from './purchase-order.policy';
import { DocumentNumberService } from '../common/services/document-number.service';
import { recordAudit } from '../common/audit/audit-log.service';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

// Lazy-loaded to avoid circular dependency with InventoryService
import type { InventoryService as InventoryServiceType } from '../inventory/inventory.service';

export class PurchaseOrderService {
  private repository = new PurchaseOrderRepository();
  private documentNumberService = new DocumentNumberService();
  private _inventoryService: InventoryServiceType | null = null;

  // Lazy load InventoryService to break circular dependency
  private get inventoryService(): InventoryServiceType {
    if (!this._inventoryService) {
      // Dynamic import at runtime
      /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
      const {
        InventoryService,
      } = require('../inventory/inventory.service.js');
      /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
      this._inventoryService = new InventoryService();
    }
    return this._inventoryService!;
  }

  /**
   * Create a new purchase order.
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
      paymentTerms?: 'NET_30' | 'PARTIAL' | 'UPFRONT'; // Feature 036
    },
    shape?: BusinessShape,
    userId?: string
  ): Promise<Order> {
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
    const taxRate = data.taxRate || 0;
    const taxAmount = (subtotal * taxRate) / 100;
    const totalAmount = subtotal + taxAmount;

    // Prepare create data
    // Feature 036: Set payment terms and initial status
    const paymentTerms = data.paymentTerms || 'NET_30';
    const createData: Prisma.OrderUncheckedCreateInput = {
      companyId,
      partnerId: data.partnerId,
      type: OrderType.PURCHASE,
      status: OrderStatus.DRAFT,
      orderNumber,
      totalAmount,
      taxRate: data.taxRate || 0,
      paymentTerms: paymentTerms,
      // If UPFRONT, set initial paymentStatus to PENDING
      paymentStatus: paymentTerms === 'UPFRONT' ? 'PENDING' : null,
      paidAmount: 0,
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
    return this.repository.findById(id, companyId, tx);
  }

  async list(companyId: string, status?: string) {
    return this.repository.findAll(companyId, status as OrderStatus);
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

    // Count existing GRNs for this PO
    const grnCount = await this.repository.countGoodsReceipts(id);

    PurchaseOrderPolicy.validateCancel(order.status, grnCount);

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
          undefined,
          tx
        );

        // Return empty movements array for backward compatibility
        return [];
      },
      { timeout: 60000 }
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
}
