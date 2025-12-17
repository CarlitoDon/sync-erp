import {
  Order,
  OrderStatus,
  OrderType,
  Prisma,
  BusinessShape,
} from '@sync-erp/database';
import { ProcurementRepository } from './procurement.repository';
import { ProcurementPolicy } from './procurement.policy';
import { DocumentNumberService } from '../common/services/document-number.service';
import { GoodsReceiptSaga } from './sagas/goods-receipt.saga';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

export class ProcurementService {
  private repository = new ProcurementRepository();
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
    shape?: BusinessShape
  ): Promise<Order> {
    // Policy check: SERVICE companies cannot purchase physical goods
    // Only enforce if shape is provided and items contain physical products
    if (shape && data.items.length > 0) {
      ProcurementPolicy.ensureCanPurchasePhysicalGoods(shape);
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

    return this.repository.create(createData);
  }

  async getById(id: string, companyId: string) {
    return this.repository.findById(id, companyId);
  }

  async list(companyId: string, status?: string) {
    return this.repository.findAll(companyId, status as OrderStatus);
  }

  async confirm(id: string, companyId: string): Promise<Order> {
    const order = await this.repository.findById(id, companyId);
    if (!order) {
      throw new DomainError(
        'Purchase order not found',
        404,
        DomainErrorCodes.ORDER_NOT_FOUND
      );
    }

    if (order.status !== OrderStatus.DRAFT) {
      throw new DomainError(
        `Cannot confirm order with status: ${order.status}`,
        422,
        DomainErrorCodes.ORDER_INVALID_STATE
      );
    }

    return this.repository.updateStatus(id, OrderStatus.CONFIRMED);
  }

  async complete(id: string, companyId: string): Promise<Order> {
    const order = await this.repository.findById(id, companyId);
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

    return this.repository.updateStatus(id, OrderStatus.COMPLETED);
  }

  async cancel(id: string, companyId: string): Promise<Order> {
    const order = await this.repository.findById(id, companyId);
    if (!order) {
      throw new DomainError(
        'Purchase order not found',
        404,
        DomainErrorCodes.ORDER_NOT_FOUND
      );
    }

    if (order.status === OrderStatus.COMPLETED) {
      throw new DomainError(
        'Cannot cancel a completed order',
        422,
        DomainErrorCodes.ORDER_INVALID_STATE
      );
    }

    return this.repository.updateStatus(id, OrderStatus.CANCELLED);
  }

  async getItems(orderId: string) {
    return this.repository.findItems(orderId);
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
