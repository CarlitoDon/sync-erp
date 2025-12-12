import {
  Payment,
  InvoiceStatus,
  InvoiceType,
} from '@sync-erp/database';
import { PaymentRepository } from '../repositories/payment.repository';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { JournalService } from './journal.service';
import { CreatePaymentDto } from '@sync-erp/shared';

export class PaymentService {
  private repository = new PaymentRepository();
  private invoiceRepository = new InvoiceRepository();
  private journalService = new JournalService();

  async create(
    companyId: string,
    data: CreatePaymentDto
  ): Promise<Payment> {
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

    // Calculate remaining balance. Trust balance field.
    const remaining = Number(invoice.balance);

    if (data.amount > remaining) {
      throw new Error(
        `Payment amount (${data.amount}) exceeds remaining balance (${remaining})`
      );
    }

    // Create the payment
    const payment = await this.repository.create({
      companyId,
      invoiceId: data.invoiceId,
      amount: data.amount,
      method: data.method,
    });

    // Update Invoice Balance
    const newBalance = remaining - data.amount;
    const newStatus =
      newBalance <= 0 ? InvoiceStatus.PAID : invoice.status;

    await this.invoiceRepository.update(invoice.id, {
      status: newStatus,
      balance: newBalance,
    });

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

    return payment;
  }

  async getById(id: string, companyId: string) {
    return this.repository.findById(id, companyId);
  }

  async list(companyId: string, invoiceId?: string) {
    return this.repository.findAll(companyId, invoiceId);
  }
}
