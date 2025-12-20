import {
  Payment,
  IdempotencyScope,
  InvoiceStatus,
  prisma,
} from '@sync-erp/database';
import { PaymentRepository } from '../repositories/payment.repository';
import { InvoiceRepository } from '../repositories/invoice.repository';
import {
  CreatePaymentInput,
  BusinessDate,
  CorrelationId,
  Money,
  DomainError,
  DomainErrorCodes,
} from '@sync-erp/shared';
import { IdempotencyService } from '../../common/services/idempotency.service';
import { JournalService } from './journal.service';

export class PaymentService {
  private repository = new PaymentRepository();
  private invoiceRepository = new InvoiceRepository();
  private idempotencyService = new IdempotencyService();
  private journalService = new JournalService();

  /**
   * Create payment atomically using Prisma transaction.
   * All operations (payment record + balance update + journal) are atomic - auto-rollback on error.
   */
  async create(
    companyId: string,
    data: CreatePaymentInput,
    idempotencyKey?: CorrelationId
  ): Promise<Payment> {
    // Idempotency Check
    if (idempotencyKey) {
      const lock = await this.idempotencyService.lock<Payment>(
        idempotencyKey,
        companyId,
        IdempotencyScope.PAYMENT_CREATE,
        data.invoiceId
      );
      if (lock.saved && lock.response) {
        return lock.response;
      }
    }

    if (data.businessDate) {
      BusinessDate.from(data.businessDate).ensureValid();
      BusinessDate.from(data.businessDate).ensureNotBackdated();
    }

    try {
      const result = await prisma.$transaction(
        async (tx) => {
          // 1. Lock invoice row for concurrency safety
          await tx.$executeRaw`SELECT 1 FROM "Invoice" WHERE id = ${data.invoiceId} FOR UPDATE`;

          // 2. Validate invoice exists and has sufficient balance
          const invoice = await this.invoiceRepository.findById(
            data.invoiceId,
            companyId,
            undefined,
            tx
          );
          if (!invoice) {
            throw new DomainError(
              'Invoice not found',
              404,
              DomainErrorCodes.INVOICE_NOT_FOUND
            );
          }

          // Phase 1 Guard: Block Multi-Currency
          const currency =
            (invoice as typeof invoice & { currency?: string })
              .currency || 'IDR';
          Money.from(0, currency).ensureBase();

          const currentBalance = Number(invoice.balance);
          if (data.amount > currentBalance) {
            throw new DomainError(
              `Payment amount ${data.amount} exceeds invoice balance ${currentBalance}`,
              422,
              DomainErrorCodes.INVOICE_INVALID_STATE
            );
          }

          // 3. Create payment record
          const payment = await this.repository.create(
            {
              companyId,
              invoiceId: data.invoiceId,
              amount: data.amount,
              method: data.method,
            },
            tx
          );

          // 4. Decrease invoice balance
          const newBalance = currentBalance - data.amount;
          await this.invoiceRepository.update(
            data.invoiceId,
            {
              balance: newBalance,
              ...(newBalance <= 0
                ? { status: InvoiceStatus.PAID }
                : {}),
            },
            tx
          );

          // 5. Create cash journal
          await this.journalService.postPaymentReceived(
            companyId,
            payment.id,
            invoice.invoiceNumber || data.invoiceId,
            data.amount,
            data.method,
            tx,
            data.businessDate
          );

          return payment;
        },
        { timeout: 60000 }
      );

      // Idempotency Complete
      if (idempotencyKey) {
        await this.idempotencyService.complete(
          idempotencyKey,
          result
        );
      }

      return result;
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

  /**
   * Void a Payment
   * Effect: Restore invoice/bill balance
   * Note: For MVP, we mark by prepending [VOIDED] to reference.
   * Schema enhancement for proper status field is recommended.
   */
  async void(id: string, companyId: string): Promise<Payment> {
    const payment = await this.repository.findById(id, companyId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    // Check if already voided (using convention - reference contains [VOIDED])
    if (payment.reference?.includes('[VOIDED]')) {
      throw new Error('Payment is already voided');
    }

    // Restore invoice balance and mark payment as voided
    const restored = await this.repository.voidPayment(
      id,
      payment.invoiceId,
      Number(payment.amount)
    );

    return restored;
  }
}
