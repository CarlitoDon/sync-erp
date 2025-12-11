import { prisma, InvoiceType, InvoiceStatus, OrderType } from '@sync-erp/database';
import type { Invoice } from '@sync-erp/database';
import { JournalService } from './JournalService';

interface CreateInvoiceInput {
  orderId: string;
  invoiceNumber?: string;
  dueDate?: Date;
  taxRate?: number; // Flat tax rate (e.g., 0.11 for 11% PPN)
}

export class InvoiceService {
  private journalService = new JournalService();

  /**
   * Create an invoice (accounts receivable) from a sales order
   */
  async createFromSalesOrder(
    companyId: string,
    _userId: string,
    data: CreateInvoiceInput
  ): Promise<Invoice> {
    // Get the sales order
    const order = await prisma.order.findFirst({
      where: { id: data.orderId, companyId, type: OrderType.SALES },
      include: { items: true, partner: true },
    });

    if (!order) {
      throw new Error('Sales order not found');
    }

    // Generate invoice number if not provided
    const invoiceCount = await prisma.invoice.count({
      where: { companyId, type: InvoiceType.INVOICE },
    });
    const invoiceNumber = data.invoiceNumber || `INV-${String(invoiceCount + 1).padStart(5, '0')}`;

    // Calculate total with optional tax
    const subtotal = Number(order.totalAmount);
    // Use input taxRate or order taxRate or 0
    let taxRate = data.taxRate;
    if (taxRate === undefined && order.taxRate !== null) {
      taxRate = Number(order.taxRate);
    }
    taxRate = taxRate || 0;

    // Handle percentage (e.g. 11) vs decimal (0.11)
    // Assumption: System uses partials like 11 for 11%.
    const taxMultiplier = taxRate > 1 ? taxRate / 100 : taxRate;

    const taxAmount = subtotal * taxMultiplier;
    const amount = subtotal + taxAmount;

    // Create the invoice
    return prisma.invoice.create({
      data: {
        companyId,
        orderId: data.orderId,
        partnerId: order.partnerId,
        type: InvoiceType.INVOICE,
        status: InvoiceStatus.DRAFT,
        invoiceNumber,
        amount,
        subtotal,
        taxAmount,
        taxRate,
        balance: amount, // Initially, balance = full amount
        dueDate: data.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
      },
      include: {
        order: { include: { items: { include: { product: true } } } },
        partner: true,
      },
    });
  }

  /**
   * Get invoice by ID
   */
  async getById(id: string, companyId: string): Promise<Invoice | null> {
    return prisma.invoice.findFirst({
      where: { id, companyId, type: InvoiceType.INVOICE },
      include: {
        order: { include: { items: { include: { product: true } } } },
        partner: true,
        payments: true,
      },
    });
  }

  /**
   * List invoices
   */
  async list(companyId: string, status?: string): Promise<Invoice[]> {
    return prisma.invoice.findMany({
      where: {
        companyId,
        type: InvoiceType.INVOICE,
        ...(status && { status: status as InvoiceStatus }),
      },
      include: {
        partner: true,
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Post/approve an invoice
   */
  async post(id: string, companyId: string): Promise<Invoice> {
    const invoice = await this.getById(id, companyId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new Error(`Cannot post invoice with status: ${invoice.status}`);
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.POSTED,
      },
      include: {
        partner: true,
      },
    });

    // Auto-post journal entry
    if (!updatedInvoice.invoiceNumber) {
      throw new Error(`Invoice ${id} has no invoice number`);
    }

    await this.journalService.postInvoice(
      companyId,
      updatedInvoice.invoiceNumber,
      Number(updatedInvoice.amount),
      Number(updatedInvoice.subtotal),
      Number(updatedInvoice.taxAmount)
    );

    return updatedInvoice;
  }

  /**
   * Void an invoice
   */
  async void(id: string, companyId: string): Promise<Invoice> {
    const invoice = await this.getById(id, companyId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new Error('Cannot void a paid invoice');
    }

    return prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.VOID,
      },
    });
  }

  /**
   * Get outstanding invoices (posted but not paid)
   */
  async getOutstanding(companyId: string): Promise<Invoice[]> {
    return prisma.invoice.findMany({
      where: {
        companyId,
        type: InvoiceType.INVOICE,
        status: InvoiceStatus.POSTED,
      },
      include: {
        partner: true,
        payments: true,
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  /**
   * Calculate remaining amount due on an invoice
   */
  async getRemainingAmount(id: string): Promise<number> {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { payments: true },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const totalPaid = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

    return Number(invoice.amount) - totalPaid;
  }
}
