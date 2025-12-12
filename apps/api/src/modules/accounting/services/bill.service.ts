import {
  Invoice,
  InvoiceStatus,
  InvoiceType,
  OrderType,
  Prisma,
} from '@sync-erp/database';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { JournalService } from './journal.service';

export interface CreateBillInput {
  orderId: string;
  invoiceNumber?: string;
  dueDate?: Date;
  taxRate?: number;
}

import { DocumentNumberService } from '../../common/services/document-number.service';

export class BillService {
  private repository = new InvoiceRepository();
  private journalService = new JournalService();
  private documentNumberService = new DocumentNumberService();

  async createFromPurchaseOrder(
    companyId: string,
    data: CreateBillInput
  ): Promise<Invoice> {
    const order = await this.repository.findOrder(
      data.orderId,
      companyId,
      OrderType.PURCHASE
    );

    if (!order) {
      throw new Error('Purchase order not found');
    }

    let invoiceNumber = data.invoiceNumber;
    if (!invoiceNumber) {
      invoiceNumber = await this.documentNumberService.generate(
        companyId,
        'BILL'
      );
    }

    const subtotal = Number(order.totalAmount);
    let taxRate = data.taxRate;
    if (taxRate === undefined && order.taxRate !== null) {
      taxRate = Number(order.taxRate);
    }
    taxRate = taxRate || 0;

    const taxMultiplier = taxRate > 1 ? taxRate / 100 : taxRate;
    const taxAmount = subtotal * taxMultiplier;
    const amount = subtotal + taxAmount;

    const createData: Prisma.InvoiceUncheckedCreateInput = {
      companyId,
      orderId: data.orderId,
      partnerId: order.partnerId,
      type: InvoiceType.BILL,
      status: InvoiceStatus.DRAFT,
      invoiceNumber,
      amount,
      subtotal,
      taxAmount,
      taxRate,
      balance: amount,
      dueDate:
        data.dueDate ||
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };

    return this.repository.create(createData);
  }

  async getById(id: string, companyId: string) {
    return this.repository.findById(id, companyId, InvoiceType.BILL);
  }

  async list(companyId: string, status?: string) {
    return this.repository.findAll(
      companyId,
      InvoiceType.BILL,
      status as InvoiceStatus
    );
  }

  async post(id: string, companyId: string): Promise<Invoice> {
    const bill = await this.repository.findById(
      id,
      companyId,
      InvoiceType.BILL
    );
    if (!bill) {
      throw new Error('Bill not found');
    }

    if (bill.status !== InvoiceStatus.DRAFT) {
      throw new Error(`Cannot post bill with status: ${bill.status}`);
    }

    const updatedBill = await this.repository.update(id, {
      status: InvoiceStatus.POSTED,
    });

    if (!updatedBill.invoiceNumber) {
      throw new Error(`Bill ${id} has no invoice number`);
    }

    await this.journalService.postBill(
      companyId,
      updatedBill.invoiceNumber,
      Number(updatedBill.amount),
      Number(updatedBill.subtotal),
      Number(updatedBill.taxAmount)
    );

    return updatedBill;
  }

  async void(id: string, companyId: string): Promise<Invoice> {
    const bill = await this.repository.findById(
      id,
      companyId,
      InvoiceType.BILL
    );
    if (!bill) {
      throw new Error('Bill not found');
    }

    if (bill.status === InvoiceStatus.PAID) {
      throw new Error('Cannot void a paid bill');
    }

    return this.repository.update(id, {
      status: InvoiceStatus.VOID,
    });
  }

  async getOutstanding(companyId: string) {
    return this.repository.findAll(
      companyId,
      InvoiceType.BILL,
      InvoiceStatus.POSTED
    );
  }

  async getRemainingAmount(
    id: string,
    companyId: string
  ): Promise<number> {
    const bill = await this.repository.findById(id, companyId);
    if (!bill) throw new Error('Bill not found');
    return Number(bill.balance);
  }
}
