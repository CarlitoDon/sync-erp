import { webhookService } from '../../../services/webhook.service';

export class ExternalOrderNotificationService {
  async notifyRentalEvent(
    companyId: string,
    event:
      | 'rental.order.created'
      | 'rental.order.updated'
      | 'rental.order.cancelled',
    payload: Record<string, unknown>
  ): Promise<void> {
    try {
      await webhookService.notifyTenant(companyId, event, payload);
    } catch (error) {
      console.error('[RentalIntegration] Webhook enqueue failed:', error);
    }
  }

  async notifyPaymentEvent(
    companyId: string,
    event:
      | 'rental.payment.claimed'
      | 'rental.payment.confirmed'
      | 'rental.payment.rejected',
    payload: Record<string, unknown>
  ): Promise<void> {
    try {
      await webhookService.notifyTenant(companyId, event, payload);
    } catch (error) {
      console.error(
        '[RentalIntegration] Payment webhook enqueue failed:',
        error
      );
    }
  }
}
