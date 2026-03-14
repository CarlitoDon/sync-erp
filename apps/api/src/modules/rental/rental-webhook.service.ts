/**
 * Webhook service for Santi Living notifications
 * Calls santi-living erp-sync-service to trigger WA notifications
 */
import { rentalWebhookOutboxService } from './rental-webhook-outbox.service';

interface NotifyPaymentStatusParams {
  companyId: string;
  token: string;
  action: 'confirmed' | 'rejected' | 'claimed';
  paymentReference?: string;
  failReason?: string;
  paymentMethod?: string;
}

interface NotifyNewOrderParams {
  companyId: string;
  token: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
}

interface NotifyOptions {
  throwOnFailure?: boolean;
}

export class RentalWebhookService {
  /**
   * Notify santi-living about payment status change
   * Fires async - failures are logged but don't block the main operation
   */
  async notifyPaymentStatus(
    params: NotifyPaymentStatusParams
  ): Promise<void> {
    const result =
      await rentalWebhookOutboxService.enqueuePaymentStatus(params);

    if (!result.success) {
      console.error(
        `[RentalWebhook] Payment status notification queued for retry: ${params.action} for ${params.token}`,
        result.error
      );
    }
  }

  /**
   * Notify admin about new website order
   * By default failures are logged and swallowed. External order creation can
   * opt into fail-fast mode so rollback behavior is explicit.
   */
  async notifyNewOrder(
    params: NotifyNewOrderParams,
    options: NotifyOptions = {}
  ): Promise<void> {
    const result = await rentalWebhookOutboxService.enqueueNewOrder(
      params,
      {
        autoRetry: !options.throwOnFailure,
      }
    );

    if (!result.success) {
      console.error(
        `[RentalWebhook] Failed to notify new order: ${params.orderNumber}`,
        result.error
      );
      if (options.throwOnFailure) {
        throw new Error(result.error || 'Webhook delivery failed');
      }
    }
  }

  /**
   * Adapter for RentalOrderLifecycleService — maps internal order to webhook params
   */
  async notifyOrderCreated(order: {
    companyId: string;
    id: string;
    orderNumber?: string;
    totalAmount?: number | { toNumber(): number };
    partner?: { name?: string; phone?: string; email?: string } | null;
  }): Promise<void> {
    await this.notifyNewOrder({
      companyId: order.companyId,
      token: order.id,
      orderNumber: order.orderNumber || 'UNKNOWN',
      customerName: order.partner?.name || 'Guest',
      customerPhone:
        order.partner?.phone || order.partner?.email || '-',
      totalAmount: Number(order.totalAmount || 0),
    });
  }

  async notifyOrderCancelled(order: {
    orderNumber?: string;
  }): Promise<void> {
    // eslint-disable-next-line no-console -- Webhook cancellation log
    console.log(
      `[RentalWebhook] Order Cancelled: ${order.orderNumber}`
    );
  }
}
