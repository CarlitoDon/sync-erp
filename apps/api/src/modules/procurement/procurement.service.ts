import {
  Order,
  OrderStatus,
  OrderType,
  Prisma,
} from '@sync-erp/database';
import { ProcurementRepository } from './procurement.repository';
import { DocumentNumberService } from '../common/services/document-number.service';

export class ProcurementService {
  private repository = new ProcurementRepository();
  private documentNumberService = new DocumentNumberService();

  async create(
    companyId: string,
    data: {
      partnerId: string;
      items: { productId: string; quantity: number; price: number }[];
      taxRate?: number;
    }
  ): Promise<Order> {
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
      throw new Error('Purchase order not found');
    }

    if (order.status !== OrderStatus.DRAFT) {
      throw new Error(
        `Cannot confirm order with status: ${order.status}`
      );
    }

    return this.repository.updateStatus(id, OrderStatus.CONFIRMED);
  }

  async complete(id: string, companyId: string): Promise<Order> {
    const order = await this.repository.findById(id, companyId);
    if (!order) {
      throw new Error('Purchase order not found');
    }

    if (order.status !== OrderStatus.CONFIRMED) {
      throw new Error(
        `Cannot complete order with status: ${order.status}`
      );
    }

    return this.repository.updateStatus(id, OrderStatus.COMPLETED);
  }

  async cancel(id: string, companyId: string): Promise<Order> {
    const order = await this.repository.findById(id, companyId);
    if (!order) {
      throw new Error('Purchase order not found');
    }

    if (order.status === OrderStatus.COMPLETED) {
      throw new Error('Cannot cancel a completed order');
    }

    return this.repository.updateStatus(id, OrderStatus.CANCELLED);
  }

  async getItems(orderId: string) {
    return this.repository.findItems(orderId);
  }
}
