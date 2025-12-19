import {
  Order,
  OrderStatus,
  OrderType,
  Prisma,
  BusinessShape,
  AuditLogAction,
  EntityType,
} from '@sync-erp/database';
import { PurchaseOrderRepository } from './purchase-order.repository';
import { PurchaseOrderPolicy } from './purchase-order.policy';
import { DocumentNumberService } from '../common/services/document-number.service';
import { recordAudit } from '../common/audit/audit-log.service';
import { GoodsReceiptSaga } from './sagas/goods-receipt.saga';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

export class PurchaseOrderService {
  private repository = new PurchaseOrderRepository();
  private documentNumberService = new DocumentNumberService();
  private goodsReceiptSaga = new GoodsReceiptSaga();

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
    const createData: Prisma.OrderUncheckedCreateInput = {
      companyId,
      partnerId: data.partnerId,
      type: OrderType.PURCHASE,
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
   * Receive goods using saga pattern for atomic execution with compensation.
   * If goods receipt fails mid-way, compensation will automatically reverse changes.
   * @throws SagaCompensatedError if goods receipt fails but was compensated
   * @throws SagaCompensationFailedError if compensation also fails
   */
  async receive(
    orderId: string,
    companyId: string,
    reference?: string,
    shape?: BusinessShape,
    items?: { id: string; quantity: number }[]
  ) {
    const result = await this.goodsReceiptSaga.execute(
      { orderId, companyId, reference, shape, items },
      orderId,
      companyId
    );

    if (!result.success || !result.data) {
      throw result.error || new Error('Goods receipt failed');
    }

    return result.data.movements;
  }
}
