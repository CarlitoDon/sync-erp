import { Payment, IdempotencyScope } from '@sync-erp/database';
import { PaymentRepository } from '../repositories/payment.repository';
import { CreatePaymentInput, BusinessDate } from '@sync-erp/shared';
import { IdempotencyService } from '../../common/services/idempotency.service';
import { PaymentPostingSaga } from '../sagas/payment-posting.saga';

export class PaymentService {
  private repository = new PaymentRepository();
  private idempotencyService = new IdempotencyService();
  private paymentPostingSaga = new PaymentPostingSaga();

  /**
   * Create payment using saga pattern for atomic execution with compensation.
   * If payment fails mid-way, compensation will automatically reverse changes.
   * @throws SagaCompensatedError if payment fails but was compensated
   * @throws SagaCompensationFailedError if compensation also fails
   */
  async create(
    companyId: string,
    data: CreatePaymentInput,
    idempotencyKey?: string
  ): Promise<Payment> {
    // Idempotency Check
    if (idempotencyKey) {
      const lock = await this.idempotencyService.lock<Payment>(
        idempotencyKey,
        companyId,
        IdempotencyScope.PAYMENT_CREATE,
        data.invoiceId // entityId: invoice receiving payment
      );
      if (lock.saved && lock.response) {
        return lock.response;
      }
    }

    if (data.businessDate) {
      BusinessDate.from(data.businessDate).ensureValid();
    }

    try {
      // Execute via saga for atomic operation with compensation
      const result = await this.paymentPostingSaga.execute(
        {
          invoiceId: data.invoiceId,
          amount: data.amount,
          method: data.method,
          businessDate: data.businessDate, // G5: Pass explicitly
          companyId,
        },
        data.invoiceId,
        companyId
      );

      if (!result.success || !result.data) {
        throw result.error || new Error('Payment creation failed');
      }

      // Idempotency Complete
      if (idempotencyKey) {
        await this.idempotencyService.complete(
          idempotencyKey,
          result.data
        );
      }

      return result.data;
    } catch (error) {
      if (idempotencyKey) {
        await this.idempotencyService.fail(idempotencyKey);
      }
      throw error;
    }
  }

  async getById(id: string, companyId: string) {
    return this.repository.findById(id, companyId);
  }

  async list(companyId: string, invoiceId?: string) {
    return this.repository.findAll(companyId, invoiceId);
  }
}
