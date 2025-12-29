import {
  Invoice,
  InvoiceStatus,
  InvoiceType,
  JournalSourceType,
  prisma,
} from '@sync-erp/database';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { DocumentNumberService } from '../../common/services/document-number.service';
import { JournalService } from './journal.service';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

export interface CreateExpenseInput {
  partnerId: string;
  date: Date;
  dueDate?: Date;
  reference?: string;
  items: {
    productId?: string;
    description: string;
    quantity: number;
    price: number;
  }[];
  taxRate?: number;
}

export class ExpenseService {
  constructor(
    private readonly repository: InvoiceRepository = new InvoiceRepository(),
    private readonly documentNumberService: DocumentNumberService = new DocumentNumberService(),
    private readonly journalService: JournalService = new JournalService()
  ) {}

  async create(
    companyId: string,
    data: CreateExpenseInput
  ): Promise<Invoice> {
    if (!data.items || data.items.length === 0) {
      throw new DomainError(
        'Expense must have items',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }

    const invoiceNumber = await this.documentNumberService.generate(
      companyId,
      'BILL'
    );

    const subtotal = data.items.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0
    );
    const taxRate = data.taxRate || 0;
    const taxAmount = subtotal * (taxRate / 100);
    const amount = subtotal + taxAmount;

    return this.repository.create({
      companyId,
      partnerId: data.partnerId,
      type: InvoiceType.EXPENSE,
      status: InvoiceStatus.DRAFT,
      invoiceNumber,
      supplierInvoiceNumber: data.reference,
      dueDate: data.dueDate || new Date(),
      createdAt: data.date,
      amount,
      subtotal,
      taxAmount,
      taxRate,
      balance: amount,
      items: {
        create: data.items.map((item) => ({
          productId: item.productId,
          description: item.description,
          quantity: item.quantity,
          price: item.price,
          amount: item.quantity * item.price,
        })),
      },
    });
  }

  async list(companyId: string) {
    return this.repository.findAll(companyId, InvoiceType.EXPENSE);
  }

  async findById(id: string, companyId: string) {
    return this.repository.findById(
      id,
      companyId,
      InvoiceType.EXPENSE
    );
  }

  async post(id: string, companyId: string) {
    return prisma.$transaction(async (tx) => {
      const expense = await this.repository.findById(
        id,
        companyId,
        InvoiceType.EXPENSE,
        tx
      );
      if (!expense)
        throw new DomainError(
          'Expense not found',
          404,
          DomainErrorCodes.INVOICE_NOT_FOUND
        );
      if (expense.status !== InvoiceStatus.DRAFT)
        throw new DomainError(
          'Expense already posted',
          400,
          DomainErrorCodes.INVOICE_INVALID_STATE
        );

      const updatedExpense = await this.repository.update(
        id,
        { status: InvoiceStatus.POSTED },
        tx
      );

      const lines: {
        accountCode: string;
        credit?: number;
        debit?: number;
      }[] = [
        { accountCode: '2100', credit: Number(expense.amount) }, // AP
        {
          accountCode: '6100',
          debit: Number(expense.subtotal || expense.amount),
        }, // Expense
      ];

      if (Number(expense.taxAmount) > 0) {
        lines.push({
          accountCode: '1500',
          debit: Number(expense.taxAmount),
        }); // VAT Input
      }

      await this.journalService.resolveAndCreate(
        companyId,
        {
          reference: `Expense: ${expense.invoiceNumber}`,
          memo: `Expense ${expense.invoiceNumber}`,
          sourceType: JournalSourceType.BILL,
          sourceId: expense.id,
          lines,
          date: expense.createdAt,
        },
        tx
      );

      return updatedExpense;
    });
  }
}
