import { prisma, InvoiceStatus, InvoiceType } from '@sync-erp/database';
import type { Payment } from '@sync-erp/database';
import { CreatePaymentDto } from '@sync-erp/shared';
import { Decimal } from '@prisma/client/runtime/library';
import { JournalService } from './JournalService';

export class PaymentService {
  private journalService = new JournalService();

  /**
   * Record a payment against an invoice
   */
  async create(companyId: string, data: CreatePaymentDto): Promise<Payment> {
    // Get the invoice
    const invoice = await prisma.invoice.findFirst({
      where: { id: data.invoiceId, companyId },
      include: { payments: true },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status === InvoiceStatus.VOID) {
      throw new Error('Cannot pay a voided invoice');
    }

    if (invoice.status === InvoiceStatus.DRAFT) {
      throw new Error('Invoice must be posted before payment');
    }

    // Calculate remaining balance
    const totalPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const remaining = Number(invoice.amount) - totalPaid;

    if (data.amount > remaining) {
      throw new Error(`Payment amount (${data.amount}) exceeds remaining balance (${remaining})`);
    }

    // Create the payment
    const payment = await prisma.payment.create({
      data: {
        companyId,
        invoiceId: data.invoiceId,
        amount: new Decimal(data.amount),
        method: data.method,
      },
    });

    // Check if invoice is fully paid
    const newTotalPaid = totalPaid + data.amount;
    if (newTotalPaid >= Number(invoice.amount)) {
      await prisma.invoice.update({
        where: { id: data.invoiceId },
        data: {
          status: InvoiceStatus.PAID,
          balance: new Decimal(0),
        },
      });
    } else {
      // Update balance
      await prisma.invoice.update({
        where: { id: data.invoiceId },
        data: {
          balance: new Decimal(Number(invoice.amount) - newTotalPaid),
        },
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

    return payment;
  }

  /**
   * Get payment by ID
   */
  async getById(id: string, companyId: string): Promise<Payment | null> {
    return prisma.payment.findFirst({
      where: { id, companyId },
      include: { invoice: true },
    });
  }

  /**
   * List payments for a company
   */
  async list(companyId: string, invoiceId?: string): Promise<Payment[]> {
    return prisma.payment.findMany({
      where: {
        companyId,
        ...(invoiceId && { invoiceId }),
      },
      include: {
        invoice: { include: { partner: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get payment history for an invoice
   */
  async getPaymentHistory(invoiceId: string): Promise<Payment[]> {
    return prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get total received for an invoice
   */
  async getTotalReceived(invoiceId: string): Promise<number> {
    const payments = await this.getPaymentHistory(invoiceId);
    return payments.reduce((sum, p) => sum + Number(p.amount), 0);
  }
}
