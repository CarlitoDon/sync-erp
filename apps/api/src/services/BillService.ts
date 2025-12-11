import { prisma, InvoiceType, InvoiceStatus, OrderType } from '@sync-erp/database';
import type { Invoice } from '@sync-erp/database';
import { JournalService } from './JournalService';

interface CreateBillInput {
  orderId: string;
  invoiceNumber?: string;
  dueDate?: Date;
}

export class BillService {
  private journalService = new JournalService();

  /**
   * Create a bill (accounts payable) from a purchase order
   */
  async createFromPurchaseOrder(
    companyId: string,
    _userId: string,
    data: CreateBillInput
  ): Promise<Invoice> {
    // Get the purchase order
    const order = await prisma.order.findFirst({
      where: { id: data.orderId, companyId, type: OrderType.PURCHASE },
      include: { items: true, partner: true },
    });

    if (!order) {
      throw new Error('Purchase order not found');
    }

    // Generate bill number if not provided
    const billCount = await prisma.invoice.count({
      where: { companyId, type: InvoiceType.BILL },
    });
    const invoiceNumber = data.invoiceNumber || `BILL-${String(billCount + 1).padStart(5, '0')}`;

    // Create the bill
    return prisma.invoice.create({
      data: {
        companyId,
        orderId: data.orderId,
        partnerId: order.partnerId,
        type: InvoiceType.BILL,
        status: InvoiceStatus.DRAFT,
        invoiceNumber,
        amount: order.totalAmount, // PO amount is total
        balance: order.totalAmount,
        dueDate: data.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
      },
      include: {
        order: { include: { items: { include: { product: true } } } },
        partner: true,
      },
    });
  }

  /**
   * Get bill by ID
   */
  async getById(id: string, companyId: string): Promise<Invoice | null> {
    return prisma.invoice.findFirst({
      where: { id, companyId, type: InvoiceType.BILL },
      include: {
        order: { include: { items: { include: { product: true } } } },
        partner: true,
        payments: true,
      },
    });
  }

  /**
   * List bills
   */
  async list(companyId: string, status?: string): Promise<Invoice[]> {
    return prisma.invoice.findMany({
      where: {
        companyId,
        type: InvoiceType.BILL,
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
   * Post/approve a bill
   */
  async post(id: string, companyId: string): Promise<Invoice> {
    const bill = await this.getById(id, companyId);
    if (!bill) {
      throw new Error('Bill not found');
    }

    if (bill.status !== InvoiceStatus.DRAFT) {
      throw new Error(`Cannot post bill with status: ${bill.status}`);
    }

    const updatedBill = await prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.POSTED,
      },
      include: {
        partner: true,
      },
    });

    // Auto-post journal entry
    if (!updatedBill.invoiceNumber) {
      throw new Error(`Bill ${id} has no invoice number`);
    }

    await this.journalService.postBill(
      companyId,
      updatedBill.invoiceNumber,
      Number(updatedBill.amount)
    );

    return updatedBill;
  }

  /**
   * Void a bill
   */
  async void(id: string, companyId: string): Promise<Invoice> {
    const bill = await this.getById(id, companyId);
    if (!bill) {
      throw new Error('Bill not found');
    }

    if (bill.status === InvoiceStatus.PAID) {
      throw new Error('Cannot void a paid bill');
    }

    return prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.VOID,
      },
    });
  }

  /**
   * Get outstanding bills (posted but not paid)
   */
  async getOutstanding(companyId: string): Promise<Invoice[]> {
    return prisma.invoice.findMany({
      where: {
        companyId,
        type: InvoiceType.BILL,
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
   * Calculate remaining amount due on a bill
   */
  async getRemainingAmount(id: string): Promise<number> {
    const bill = await prisma.invoice.findUnique({
      where: { id },
      include: { payments: true },
    });

    if (!bill) {
      throw new Error('Bill not found');
    }

    const totalPaid = bill.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

    return Number(bill.amount) - totalPaid;
  }
}
