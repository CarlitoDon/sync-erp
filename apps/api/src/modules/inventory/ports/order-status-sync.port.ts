import { Prisma } from '@sync-erp/database';

export interface OrderStatusSyncPort {
  /**
   * Recalculates and persists the status of an order following a fulfillment event (post or void).
   */
  recalculateOrderStatus(
    orderId: string,
    companyId: string,
    tx?: Prisma.TransactionClient
  ): Promise<void>;
}
