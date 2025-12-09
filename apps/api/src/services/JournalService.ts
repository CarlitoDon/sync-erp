import { prisma } from '@sync-erp/database';
import type { JournalEntry } from '@sync-erp/database';
import { Decimal } from '@prisma/client/runtime/library';
import { AccountService } from './AccountService';

interface JournalLineInput {
  accountCode: string;
  debit?: number;
  credit?: number;
}

interface CreateJournalInput {
  reference?: string;
  date?: Date;
  memo?: string;
  lines: JournalLineInput[];
}

export class JournalService {
  private accountService = new AccountService();

  /**
   * Create a journal entry with lines
   */
  async create(companyId: string, data: CreateJournalInput): Promise<JournalEntry> {
    // Validate: debits must equal credits
    const totalDebit = data.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
    const totalCredit = data.lines.reduce((sum, l) => sum + (l.credit || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(
        `Journal entry is unbalanced. Debits: ${totalDebit}, Credits: ${totalCredit}`
      );
    }

    // Resolve account codes to IDs
    const lineData: { accountId: string; debit: Decimal; credit: Decimal }[] = [];
    for (const line of data.lines) {
      const account = await this.accountService.getByCode(companyId, line.accountCode);
      if (!account) {
        throw new Error(`Account not found: ${line.accountCode}`);
      }
      lineData.push({
        accountId: account.id,
        debit: new Decimal(line.debit || 0),
        credit: new Decimal(line.credit || 0),
      });
    }

    return prisma.journalEntry.create({
      data: {
        companyId,
        reference: data.reference,
        date: data.date || new Date(),
        memo: data.memo,
        lines: {
          create: lineData,
        },
      },
      include: {
        lines: { include: { account: true } },
      },
    });
  }

  /**
   * Get journal entry by ID
   */
  async getById(id: string, companyId: string): Promise<JournalEntry | null> {
    return prisma.journalEntry.findFirst({
      where: { id, companyId },
      include: {
        lines: { include: { account: true } },
      },
    });
  }

  /**
   * List journal entries
   */
  async list(companyId: string, startDate?: Date, endDate?: Date): Promise<JournalEntry[]> {
    return prisma.journalEntry.findMany({
      where: {
        companyId,
        ...(startDate && { date: { gte: startDate } }),
        ...(endDate && { date: { lte: endDate } }),
      },
      include: {
        lines: { include: { account: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Create journal entry for an invoice (AR)
   * Dr. Accounts Receivable
   * Cr. Sales Revenue
   */
  async postInvoice(
    companyId: string,
    invoiceNumber: string,
    amount: number
  ): Promise<JournalEntry> {
    return this.create(companyId, {
      reference: `Invoice: ${invoiceNumber}`,
      memo: `Auto-generated from invoice ${invoiceNumber}`,
      lines: [
        { accountCode: '1300', debit: amount }, // Accounts Receivable
        { accountCode: '4100', credit: amount }, // Sales Revenue
      ],
    });
  }

  /**
   * Create journal entry for a bill (AP)
   * Dr. Expense (or Inventory)
   * Cr. Accounts Payable
   */
  async postBill(companyId: string, billNumber: string, amount: number): Promise<JournalEntry> {
    return this.create(companyId, {
      reference: `Bill: ${billNumber}`,
      memo: `Auto-generated from bill ${billNumber}`,
      lines: [
        { accountCode: '1400', debit: amount }, // Inventory
        { accountCode: '2100', credit: amount }, // Accounts Payable
      ],
    });
  }

  /**
   * Create journal entry for a payment received
   * Dr. Cash/Bank
   * Cr. Accounts Receivable
   */
  async postPaymentReceived(
    companyId: string,
    invoiceNumber: string,
    amount: number,
    method: string
  ): Promise<JournalEntry> {
    const cashAccount = method === 'BANK_TRANSFER' ? '1200' : '1100'; // Bank or Cash
    return this.create(companyId, {
      reference: `Payment received: ${invoiceNumber}`,
      memo: `Payment via ${method}`,
      lines: [
        { accountCode: cashAccount, debit: amount },
        { accountCode: '1300', credit: amount }, // Accounts Receivable
      ],
    });
  }

  /**
   * Create journal entry for a payment made (bill payment)
   * Dr. Accounts Payable
   * Cr. Cash/Bank
   */
  async postPaymentMade(
    companyId: string,
    billNumber: string,
    amount: number,
    method: string
  ): Promise<JournalEntry> {
    const cashAccount = method === 'BANK_TRANSFER' ? '1200' : '1100';
    return this.create(companyId, {
      reference: `Payment made: ${billNumber}`,
      memo: `Payment via ${method}`,
      lines: [
        { accountCode: '2100', debit: amount }, // Accounts Payable
        { accountCode: cashAccount, credit: amount },
      ],
    });
  }
}
