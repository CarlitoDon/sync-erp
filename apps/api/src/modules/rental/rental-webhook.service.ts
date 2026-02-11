/**
 * Webhook service for Santi Living notifications
 * Calls santi-living erp-sync-service to trigger WA notifications
 */

interface NotifyPaymentStatusParams {
  token: string;
  action: 'confirmed' | 'rejected' | 'claimed';
  paymentReference?: string;
  failReason?: string;
  paymentMethod?: string;
}

interface NotifyNewOrderParams {
  token: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
}

export class RentalWebhookService {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.baseUrl =
      process.env.SANTI_LIVING_WEBHOOK_URL || 'http://localhost:3002';
    this.apiKey = process.env.SANTI_LIVING_WEBHOOK_API_KEY || '';
  }

  /**
   * Notify santi-living about payment status change
   * Fires async - failures are logged but don't block the main operation
   */
  async notifyPaymentStatus(
    params: NotifyPaymentStatusParams
  ): Promise<void> {
    if (!this.apiKey) {
      console.warn(
        '[RentalWebhook] SANTI_LIVING_WEBHOOK_API_KEY not configured, skipping notification'
      );
      return;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/api/orders/${params.token}/notify-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            action: params.action,
            paymentReference: params.paymentReference,
            failReason: params.failReason,
            paymentMethod: params.paymentMethod,
          }),
        }
      );

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({}))) as {
          message?: string;
        };
        console.error(
          `[RentalWebhook] Failed to notify payment status: ${response.status}`,
          errorData
        );
      } else {
        // eslint-disable-next-line no-console -- Webhook success log
        console.log(
          `[RentalWebhook] Payment status notification sent: ${params.action} for ${params.token}`
        );
      }
    } catch (error) {
      // Log but don't throw - webhook failures shouldn't block main operation
      console.error(
        '[RentalWebhook] Error sending notification:',
        error
      );
    }
  }

  /**
   * Notify admin about new website order
   * Fires async - failures are logged but don't block the main operation
   */
  async notifyNewOrder(params: NotifyNewOrderParams): Promise<void> {
    if (!this.apiKey) {
      console.warn(
        '[RentalWebhook] SANTI_LIVING_WEBHOOK_API_KEY not configured, skipping notification'
      );
      return;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/api/orders/${params.token}/notify-admin`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            action: 'new_order',
            orderNumber: params.orderNumber,
            customerName: params.customerName,
            customerPhone: params.customerPhone,
            totalAmount: params.totalAmount,
          }),
        }
      );

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({}))) as {
          message?: string;
        };
        console.error(
          `[RentalWebhook] Failed to notify new order: ${response.status}`,
          errorData
        );
        // Throw error so the caller (public-rental.router) can handle it (e.g. rollback)
        throw new Error(
          errorData.message || `Webhook failed: ${response.status}`
        );
      } else {
        // eslint-disable-next-line no-console -- Webhook success log
        console.log(
          `[RentalWebhook] New order notification sent: ${params.orderNumber}`
        );
      }
    } catch (error) {
      console.error(
        '[RentalWebhook] Error sending new order notification:',
        error
      );
    }
  }

  /**
   * Adapter for RentalOrderLifecycleService
   */
  async notifyOrderCreated(order: any): Promise<void> {
    // Map internal order to webhook params
    // Assuming order has relations included or at least basic fields
    await this.notifyNewOrder({
      token: order.id, // Using order ID as token for now, or generate one
      orderNumber: order.orderNumber || 'UNKNOWN',
      customerName: order.partner?.name || 'Guest',
      customerPhone:
        order.partner?.phone || order.partner?.email || '-',
      totalAmount: Number(order.totalAmount || 0),
    });
  }

  async notifyOrderCancelled(order: any): Promise<void> {
    if (!this.apiKey) return;

    // Currently no specific endpoint for cancellation in the interface,
    // but we can log it or maybe send a status update if supported.
    // For now, mirroring the payment status or just logging to avoid crash.
    console.log(
      `[RentalWebhook] Order Cancelled: ${order.orderNumber}`
    );

    // If there is a generic status endpoint, we could use it.
    // For now, implementation is placeholder to prevent runtime errors.
  }
}
