/**
 * Webhook service for rental notifications
 * Enqueues deliveries through the rental webhook outbox for partner integrations
 */
import { webhookOutboxService } from './webhook-outbox.service';

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
   * Notify partner integration about payment status change
   * Fires async - failures are logged but don't block the main operation
   */
  async notifyPaymentStatus(
    params: NotifyPaymentStatusParams
  ): Promise<void> {
    const result =
      await webhookOutboxService.enqueue('payment.status.changed', {
        companyId: params.companyId,
        orderPublicToken: params.token,
        payload: {
          action: params.action,
          paymentReference: params.paymentReference,
          failReason: params.failReason,
          paymentMethod: params.paymentMethod,
          token: params.token,
        }
      });

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
    const result = await webhookOutboxService.enqueue('order.created', {
        companyId: params.companyId,
        orderPublicToken: params.token,
        orderNumber: params.orderNumber,
        autoRetry: !options.throwOnFailure,
        payload: {
          orderNumber: params.orderNumber,
          customerName: params.customerName,
          customerPhone: params.customerPhone,
          totalAmount: params.totalAmount,
          token: params.token,
        }
    });

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
    partner?: {
      name?: string;
      phone?: string;
      email?: string;
    } | null;
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
