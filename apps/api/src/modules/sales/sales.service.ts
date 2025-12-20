import {
  Order,
  OrderStatus,
  OrderType,
  Prisma,
  BusinessShape,
  prisma,
} from '@sync-erp/database';
import { SalesRepository } from './sales.repository';
import { SalesPolicy } from './sales.policy';
import { ProductService } from '../product/product.service';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

// We define input interface if shared doesn't export strict DTO for internal use yet
// Shared exports CreateSalesOrderInput (inferred from schema)
// Interface: item has { productId, quantity, price }
// CreateSalesOrderInput has { type: 'SALES', items: ... }

import { DocumentNumberService } from '../common/services/document-number.service';
import { InventoryService } from '../inventory/inventory.service.js';

export class SalesService {
  private repository = new SalesRepository();
  private productService = new ProductService();
  private documentNumberService = new DocumentNumberService();
  private inventoryService = new InventoryService();

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

    SalesPolicy.validateUpdate(
      order.status,
      { orderNumber: data.orderNumber as string | undefined },
      order.orderNumber || ''
    );

    return this.repository.update(id, data);
  }

  async confirm(id: string, companyId: string): Promise<Order> {
    const order = await this.repository.findById(id, companyId);
    if (!order) {
      throw new Error('Sales order not found');
    }

    if (order.status !== OrderStatus.DRAFT) {
      throw new DomainError(
        `Cannot confirm order with status: ${order.status}`,
        422,
        DomainErrorCodes.ORDER_INVALID_STATE
      );
    }

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

    return this.repository.updateStatus(id, OrderStatus.CONFIRMED);
  }

  /**
   * Ship/Deliver Order atomically using Prisma transaction.
   * All operations (validate SO + check stock + create shipment + update status) are atomic.
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
        const shipment = await this.inventoryService.createShipment(
          companyId,
          {
            salesOrderId: orderId,
            notes:
              reference || `Shipment for Order ${order.orderNumber}`,
            items: order.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
          },
          tx
        );

        // 5. Post Shipment (Stock OUT + COGS Snapshot)
        await this.inventoryService.postShipment(
          companyId,
          shipment.id,
          tx
        );

        // 6. Update order status to COMPLETED
        await this.repository.updateStatus(
          orderId,
          OrderStatus.COMPLETED,
          tx
        );

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

  async cancel(id: string, companyId: string): Promise<Order> {
    const order = await this.repository.findById(id, companyId);
    if (!order) throw new Error('Sales order not found');

    if (order.status === OrderStatus.COMPLETED) {
      throw new DomainError(
        'Cannot cancel a completed order',
        422,
        DomainErrorCodes.ORDER_INVALID_STATE
      );
    }

    return this.repository.updateStatus(id, OrderStatus.CANCELLED);
  }
}
