import {
  Order,
  OrderStatus,
  OrderType,
  Prisma,
  BusinessShape,
} from '@sync-erp/database';
import { SalesRepository } from './sales.repository';
import { SalesPolicy } from './sales.policy';
import { ProductService } from '../product/product.service';

// We define input interface if shared doesn't export strict DTO for internal use yet
// Shared exports CreateSalesOrderInput (inferred from schema)
// Interface: item has { productId, quantity, price }
// CreateSalesOrderInput has { type: 'SALES', items: ... }

import { DocumentNumberService } from '../common/services/document-number.service';
import { ShipmentSaga } from './sagas/shipment.saga';

export class SalesService {
  private repository = new SalesRepository();
  private productService = new ProductService();
  private documentNumberService = new DocumentNumberService();
  private shipmentSaga = new ShipmentSaga();

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
    shape?: BusinessShape
  ): Promise<Order> {
    // Policy check: SERVICE companies cannot sell physical goods
    // Only enforce if shape is provided and items contain physical products
    if (shape && data.items.length > 0) {
      SalesPolicy.ensureCanSellPhysicalGoods(shape);
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
      throw new Error('Sales order not found');
    }

    if (order.status !== OrderStatus.DRAFT) {
      throw new Error(
        `Cannot confirm order with status: ${order.status}`
      );
    }

    // Check stock availability
    for (const item of order.items) {
      const hasStock = await this.productService.checkStock(
        item.productId,
        item.quantity
      );
      if (!hasStock) {
        throw new Error(
          `Insufficient stock for product: ${item.product.name}`
        );
      }
    }

    return this.repository.updateStatus(id, OrderStatus.CONFIRMED);
  }

  /**
   * Ship/Deliver Order using saga pattern for atomic execution with compensation.
   * If shipment fails mid-way, compensation will automatically reverse changes.
   * @throws SagaCompensatedError if shipping fails but was compensated
   * @throws SagaCompensationFailedError if compensation also fails
   */
  async ship(
    companyId: string,
    orderId: string,
    reference?: string,
    shape?: BusinessShape,
    configs?: { key: string; value: Prisma.JsonValue }[]
  ) {
    const result = await this.shipmentSaga.execute(
      { orderId, companyId, reference, shape, configs },
      orderId,
      companyId
    );

    if (!result.success || !result.data) {
      throw result.error || new Error('Shipment failed');
    }

    return result.data.movements;
  }

  async complete(id: string) {
    return this.repository.updateStatus(id, OrderStatus.COMPLETED);
  }

  async cancel(id: string, companyId: string): Promise<Order> {
    const order = await this.repository.findById(id, companyId);
    if (!order) throw new Error('Sales order not found');

    if (order.status === OrderStatus.COMPLETED) {
      throw new Error('Cannot cancel a completed order');
    }

    return this.repository.updateStatus(id, OrderStatus.CANCELLED);
  }
}
