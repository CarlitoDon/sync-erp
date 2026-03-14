import crypto from 'crypto';
import { TenantWebhookOutboxStatus } from '@sync-erp/database';
import { tenantWebhookOutboxService } from './tenant-webhook-outbox.service';
import { WEBHOOK_TEST_TIMEOUT_MS } from '@sync-erp/shared';

export interface WebhookEvent {
  event: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

export interface WebhookDeliveryResult {
  success: boolean;
  status?: TenantWebhookOutboxStatus;
  statusCode?: number;
  error?: string;
  duration?: number;
  attempts?: number;
}

/**
 * Service for sending webhook notifications to tenant endpoints
 */
export class WebhookService {
  private static instance: WebhookService;

  static getInstance(): WebhookService {
    if (!WebhookService.instance) {
      WebhookService.instance = new WebhookService();
    }
    return WebhookService.instance;
  }

  /**
   * Generate HMAC-SHA256 signature for webhook payload
   */
  private generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Send webhook notification to a tenant
   * @param companyId - The company ID to look up webhook config
   * @param event - Event name (e.g., 'order.created', 'payment.received')
   * @param payload - Event payload data
   */
  async notifyTenant(
    companyId: string,
    event: string,
    payload: Record<string, unknown>
  ): Promise<WebhookDeliveryResult> {
    return tenantWebhookOutboxService.enqueueDelivery({
      companyId,
      event,
      payload,
    });
  }

  /**
   * Send webhook for order events
   */
  async notifyOrderEvent(
    companyId: string,
    event:
      | 'order.created'
      | 'order.confirmed'
      | 'order.delivered'
      | 'order.cancelled',
    order: {
      id: string;
      orderNumber: string;
      status: string;
      totalAmount: number | { toNumber: () => number };
      publicToken?: string;
      partner?: { name: string; phone: string | null };
    }
  ) {
    return this.notifyTenant(companyId, event, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount:
        typeof order.totalAmount === 'number'
          ? order.totalAmount
          : order.totalAmount.toNumber(),
      publicToken: order.publicToken,
      customer: order.partner
        ? {
            name: order.partner.name,
            phone: order.partner.phone,
          }
        : undefined,
    });
  }

  /**
   * Send webhook for payment events
   */
  async notifyPaymentEvent(
    companyId: string,
    event: 'payment.received' | 'payment.failed',
    order: {
      id: string;
      orderNumber: string;
      rentalPaymentStatus: string;
      totalAmount: number | { toNumber: () => number };
      paymentMethod?: string | null;
      paymentReference?: string | null;
    }
  ) {
    return this.notifyTenant(companyId, event, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentStatus: order.rentalPaymentStatus,
      totalAmount:
        typeof order.totalAmount === 'number'
          ? order.totalAmount
          : order.totalAmount.toNumber(),
      paymentMethod: order.paymentMethod,
      paymentReference: order.paymentReference,
    });
  }

  /**
   * Test webhook connectivity
   */
  async testWebhook(
    webhookUrl: string,
    webhookSecret?: string
  ): Promise<WebhookDeliveryResult> {
    const testEvent: WebhookEvent = {
      event: 'test.ping',
      payload: { message: 'Webhook test from Sync ERP' },
      timestamp: Date.now(),
    };

    const body = JSON.stringify(testEvent);
    const signature = webhookSecret
      ? this.generateSignature(body, webhookSecret)
      : '';

    const startTime = Date.now();

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': 'test.ping',
          'X-Webhook-Timestamp': testEvent.timestamp.toString(),
        },
        body,
        signal: AbortSignal.timeout(WEBHOOK_TEST_TIMEOUT_MS),
      });

      const duration = Date.now() - startTime;
      return {
        success: response.ok,
        statusCode: response.status,
        duration,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Connection failed',
        duration: Date.now() - startTime,
      };
    }
  }
}

// Singleton export
export const webhookService = WebhookService.getInstance();
