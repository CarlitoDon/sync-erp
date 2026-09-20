import {
  getDb,
  Prisma,
  OrderStatus,
  OrderType,
  FulfillmentType,
  DocumentStatus,
} from '@sync-erp/database';
import { OrderStatusSyncPort } from './order-status-sync.port';

export class DefaultShipmentOrderStatusSync implements OrderStatusSyncPort {
  async recalculateOrderStatus(
    orderId: string,
    companyId: string,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const db = getDb(tx);
    const order = await db.order.findFirst({
      where: { id: orderId, companyId, type: OrderType.SALES },
      include: { items: true },
    });
    if (
      !order ||
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.DRAFT
    ) {
      return;
    }

    const shippedItems = await db.fulfillmentItem.findMany({
      where: {
        fulfillment: {
          orderId,
          companyId,
          type: FulfillmentType.SHIPMENT,
          status: DocumentStatus.POSTED,
        },
      },
      select: { productId: true, quantity: true },
    });

    const shippedQty = new Map<string, number>();
    for (const item of shippedItems) {
      const current = shippedQty.get(item.productId) || 0;
      shippedQty.set(item.productId, current + Number(item.quantity));
    }

    let totalOrdered = 0;
    let totalShipped = 0;
    for (const item of order.items) {
      totalOrdered += item.quantity;
      totalShipped += shippedQty.get(item.productId) || 0;
    }

    let newStatus = order.status;
    if (totalShipped === 0) {
      newStatus = OrderStatus.CONFIRMED;
    } else if (totalShipped < totalOrdered) {
      newStatus = OrderStatus.PARTIALLY_SHIPPED;
    } else {
      newStatus = OrderStatus.SHIPPED;
    }

    if (newStatus !== order.status) {
      await db.order.update({
        where: { id: orderId },
        data: { status: newStatus },
      });
    }
  }
}

export class DefaultGRNOrderStatusSync implements OrderStatusSyncPort {
  async recalculateOrderStatus(
    orderId: string,
    companyId: string,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const db = getDb(tx);
    const order = await db.order.findFirst({
      where: { id: orderId, companyId, type: OrderType.PURCHASE },
      include: { items: true },
    });
    if (
      !order ||
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.DRAFT
    ) {
      return;
    }

    const receivedItems = await db.fulfillmentItem.findMany({
      where: {
        fulfillment: {
          orderId,
          companyId,
          type: FulfillmentType.RECEIPT,
          status: DocumentStatus.POSTED,
        },
      },
      select: { productId: true, quantity: true },
    });

    const receivedQty = new Map<string, number>();
    for (const item of receivedItems) {
      const current = receivedQty.get(item.productId) || 0;
      receivedQty.set(item.productId, current + Number(item.quantity));
    }

    let totalOrdered = 0;
    let totalReceived = 0;
    for (const item of order.items) {
      totalOrdered += item.quantity;
      totalReceived += receivedQty.get(item.productId) || 0;
    }

    let newStatus = order.status;
    if (totalReceived === 0) {
      newStatus = OrderStatus.CONFIRMED;
    } else if (totalReceived < totalOrdered) {
      newStatus = OrderStatus.PARTIALLY_RECEIVED;
    } else {
      newStatus = OrderStatus.RECEIVED;
    }

    if (newStatus !== order.status) {
      await db.order.update({
        where: { id: orderId },
        data: { status: newStatus },
      });
    }
  }
}
