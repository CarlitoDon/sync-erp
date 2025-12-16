import {
  Payment,
  InvoiceStatus,
  InvoiceType,
  Prisma,
  IdempotencyScope,
} from '@sync-erp/database';
import { PaymentRepository } from '../repositories/payment.repository';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { JournalService } from './journal.service';
import { CreatePaymentDto } from '@sync-erp/shared';
import { IdempotencyService } from '../../common/services/idempotency.service';

export class PaymentService {
  private repository = new PaymentRepository();
  private invoiceRepository = new InvoiceRepository();
  private journalService = new JournalService();
  private idempotencyService = new IdempotencyService();

  async create(
    companyId: string,
    data: CreatePaymentDto,
    idempotencyKey?: string
  ): Promise<Payment> {
    // 1. Idempotency Check
    if (idempotencyKey) {
      const lock = await this.idempotencyService.lock<Payment>(
        idempotencyKey,
        companyId,
        IdempotencyScope.PAYMENT_CREATE
      );
      if (lock.saved && lock.response) {
        return lock.response;
      }
    }

    try {
      // Get the invoice
      const invoice = await this.invoiceRepository.findById(
        data.invoiceId,
        companyId
      );

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.status === InvoiceStatus.VOID) {
        throw new Error('Cannot pay a voided invoice');
      }

      if (invoice.status === InvoiceStatus.DRAFT) {
        throw new Error('Invoice must be posted before payment');
      }

      // Attempt Atomic Payment (T020 Guard)
      let updatedInvoice;
      try {
        updatedInvoice =
          await this.invoiceRepository.decreaseBalanceWithGuard(
            invoice.id,
            data.amount
          );
      } catch (error) {
        if (
          (error as Prisma.PrismaClientKnownRequestError).code ===
          'P2025'
        ) {
          throw new Error(
            `Payment amount (${data.amount}) exceeds remaining balance`
          );
        }
        throw error;
      }

      // Create the payment
      const payment = await this.repository.create({
        companyId,
        invoiceId: data.invoiceId,
        amount: data.amount,
        method: data.method,
      });

      // Update Status if paid in full
      // Note: Balance is already decremented safely
      if (Number(updatedInvoice.balance) <= 0) {
        await this.invoiceRepository.update(invoice.id, {
          status: InvoiceStatus.PAID,
        });
      }

      // Auto-post journal entry
      if (!invoice.invoiceNumber) {
        throw new Error(`Invoice/Bill ${invoice.id} has no number`);
      }

      if (invoice.type === InvoiceType.INVOICE) {
        await this.journalService.postPaymentReceived(
          companyId,
          invoice.invoiceNumber,
          data.amount,
          data.method
        );
      } else if (invoice.type === InvoiceType.BILL) {
        await this.journalService.postPaymentMade(
          companyId,
          invoice.invoiceNumber,
          data.amount,
          data.method
        );
      }

      // 2. Idempotency Complete
      if (idempotencyKey) {
        await this.idempotencyService.complete(
          idempotencyKey,
          payment
        );
      }

      return payment;
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
