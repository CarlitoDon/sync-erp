import {
  Payment,
  IdempotencyScope,
  InvoiceStatus,
  InvoiceType,
  PaymentTerms,
  PaymentStatus,
  prisma,
} from '@sync-erp/database';
import { PaymentRepository } from '../repositories/payment.repository';
import { InvoiceRepository } from '../repositories/invoice.repository';
import {
  CreatePaymentInput,
  BusinessDate,
  CorrelationId,
  DomainError,
  DomainErrorCodes,
} from '@sync-erp/shared';
import { IdempotencyService } from '../../common/services/idempotency.service';
import { JournalService } from './journal.service';
import { PaymentPolicy } from '../policies/payment.policy';

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

          // 2. Validate invoice using PaymentPolicy
          const invoiceOrNull = await this.invoiceRepository.findById(
            data.invoiceId,
            companyId,
            undefined,
            tx
          );
          PaymentPolicy.validateCreate(
            invoiceOrNull,
            data,
            companyId
          );
          // After validation, invoice is guaranteed non-null
          const invoice = invoiceOrNull!;

          const currentBalance = Number(invoice.balance);

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

          // 4. Decrease invoice balance and update status (FR-016)
          const newBalance = currentBalance - data.amount;
          let newStatus: InvoiceStatus | undefined;
          if (newBalance <= 0) {
            newStatus = InvoiceStatus.PAID;
          } else if (
            invoice.status === InvoiceStatus.POSTED &&
            newBalance < Number(invoice.amount)
          ) {
            // Partial payment: transition from POSTED to PARTIALLY_PAID
            newStatus = InvoiceStatus.PARTIALLY_PAID;
          }

          await this.invoiceRepository.update(
            data.invoiceId,
            {
              balance: newBalance,
              ...(newStatus ? { status: newStatus } : {}),
            },
            tx
          );

          // 5. Create cash journal
          if (invoice.type === InvoiceType.BILL) {
            await this.journalService.postPaymentMade(
              companyId,
              payment.id,
              invoice.invoiceNumber || data.invoiceId,
              data.amount,
              data.method,
              tx
            );
          } else {
            await this.journalService.postPaymentReceived(
              companyId,
              payment.id,
              invoice.invoiceNumber || data.invoiceId,
              data.amount,
              data.method,
              tx,
              data.businessDate
            );
          }

          // 6. Feature 036: When Bill is fully paid, update linked UPFRONT PO.paymentStatus
          if (newBalance <= 0 && invoice.orderId) {
            const order = await tx.order.findUnique({
              where: { id: invoice.orderId },
              select: { paymentTerms: true },
            });
            if (order?.paymentTerms === PaymentTerms.UPFRONT) {
              await tx.order.update({
                where: { id: invoice.orderId },
                data: { paymentStatus: PaymentStatus.PAID_UPFRONT },
              });
            }
          }

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
   * Void a Payment atomically using Prisma transaction.
   * Effect: Restore invoice/bill balance + reverse journal entry
   * FR-024: Requires mandatory reason field for audit trail.
   */
  async void(
    id: string,
    companyId: string,
    _actorId: string, // Reserved for future audit log integration
    reason: string,
    userPermissions?: string[] // FR-026: Granular permissions array
  ): Promise<Payment> {
    // FR-026: Void Payment requires 'payment:void' permission
    const requiredPermission = 'payment:void';
    const hasPermission =
      userPermissions?.includes(requiredPermission) ||
      userPermissions?.includes('payment:*') ||
      userPermissions?.includes('*:*');

    if (!hasPermission) {
      throw new DomainError(
        `Missing permission: ${requiredPermission}`,
        403,
        DomainErrorCodes.FORBIDDEN
      );
    }

    // FR-024: Reason is mandatory
    if (!reason || reason.trim().length === 0) {
      throw new DomainError(
        'Void reason is required',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }

    return prisma.$transaction(
      async (tx) => {
        // 1. Lock payment row for concurrency safety
        await tx.$executeRaw`SELECT 1 FROM "Payment" WHERE id = ${id} FOR UPDATE`;

        // 2. Validate payment exists
        const payment = await this.repository.findById(
          id,
          companyId,
          tx
        );
        if (!payment) {
          throw new DomainError(
            'Payment not found',
            404,
            DomainErrorCodes.PAYMENT_NOT_FOUND
          );
        }

        // 3. Check if already voided
        if (payment.reference?.includes('[VOIDED]')) {
          throw new DomainError(
            'Payment is already voided',
            422,
            DomainErrorCodes.PAYMENT_ALREADY_VOIDED
          );
        }

        // 4. Get invoice details for journal reversal
        // Feature 036: invoiceId may be null for upfront payments
        if (!payment.invoiceId) {
          throw new DomainError(
            'Cannot void upfront payment via this method',
            422,
            DomainErrorCodes.PAYMENT_INVALID_TYPE
          );
        }
        const invoice = await this.invoiceRepository.findById(
          payment.invoiceId,
          companyId,
          undefined,
          tx
        );
        if (!invoice) {
          throw new DomainError(
            'Associated invoice not found',
            404,
            DomainErrorCodes.INVOICE_NOT_FOUND
          );
        }

        // 5. Create journal reversal based on invoice type
        // INVOICE type = AR (payment received), BILL type = AP (payment made)
        if (invoice.type === InvoiceType.INVOICE) {
          await this.journalService.postPaymentReceivedReversal(
            companyId,
            id,
            invoice.invoiceNumber || payment.invoiceId,
            Number(payment.amount),
            payment.method,
            tx
          );
        } else if (invoice.type === InvoiceType.BILL) {
          await this.journalService.postPaymentMadeReversal(
            companyId,
            id,
            invoice.invoiceNumber || payment.invoiceId,
            Number(payment.amount),
            payment.method,
            tx
          );
        }

        // 6. Restore invoice balance and mark payment as voided
        // Store reason in reference for audit (FR-024)
        return this.repository.voidPayment(
          id,
          payment.invoiceId,
          Number(payment.amount),
          tx,
          reason
        );
      },
      { timeout: 60000 }
    );
  }
}
