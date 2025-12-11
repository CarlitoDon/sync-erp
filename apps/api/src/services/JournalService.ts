import { prisma } from '@sync-erp/database';
import type { JournalEntry } from '@sync-erp/database';
import { Decimal } from '@prisma/client/runtime/library';
import { AccountService } from './AccountService';
// import { CreateJournalEntryInput } from '@sync-erp/shared';
// Defining locally to avoid build issues
export interface CreateJournalLineInput {
  accountId: string;
  debit: number;
  credit: number;
}
export interface CreateJournalEntryInput {
  date?: string | Date;
  reference?: string;
  memo?: string;
  lines: CreateJournalLineInput[];
}

export class JournalService {
  private accountService = new AccountService();

  /**
   * Create a journal entry with lines (Public API)
   * Expects resolved accountIds
   */
  async create(companyId: string, data: CreateJournalEntryInput): Promise<JournalEntry> {
    // Validate: debits must equal credits
    const totalDebit = data.lines.reduce(
      (sum: number, l: CreateJournalLineInput) => sum + (l.debit || 0),
      0
    );
    const totalCredit = data.lines.reduce(
      (sum: number, l: CreateJournalLineInput) => sum + (l.credit || 0),
      0
    );

    // Allow small floating point error
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(
        `Journal entry is unbalanced. Debits: ${totalDebit}, Credits: ${totalCredit}`
      );
    }

    // Verify accounts exist
    const lineData: { accountId: string; debit: Decimal; credit: Decimal }[] = [];
    for (const line of data.lines) {
      const account = await this.accountService.getById(line.accountId, companyId);
      if (!account) {
        throw new Error(`Account not found: ${line.accountId}`);
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
        date: data.date ? new Date(data.date) : new Date(),
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

  // ============================================
  // Auto-Posting Helpers (Internal)
  // These methods resolve System Account Codes (e.g. 1100, 1200) to IDs
  // ============================================

  private async resolveAndCreate(
    companyId: string,
    data: {
      reference: string;
      memo: string;
      date?: Date;
      lines: { accountCode: string; debit?: number; credit?: number }[];
    }
  ) {
    const resolvedLines = [];
    for (const line of data.lines) {
      const acc = await this.accountService.getByCode(companyId, line.accountCode);
      if (!acc) {
        // Fallback or Error? Error for now, system accounts MUST exist.
        throw new Error(`System Account code ${line.accountCode} not found. Please seed defaults.`);
      }
      resolvedLines.push({
        accountId: acc.id,
        debit: line.debit || 0,
        credit: line.credit || 0,
      });
    }

    return this.create(companyId, {
      date: (data.date || new Date()).toISOString(),
      reference: data.reference,
      memo: data.memo,
      lines: resolvedLines,
    });
  }

  /**
   * Create journal entry for an invoice (AR)
   * Dr. Accounts Receivable (1300)
   * Cr. Sales Revenue (4100)
   */
  async postInvoice(
    companyId: string,
    invoiceNumber: string,
    amount: number
  ): Promise<JournalEntry> {
    return this.resolveAndCreate(companyId, {
      reference: `Invoice: ${invoiceNumber}`,
      memo: `Auto-generated from invoice ${invoiceNumber}`,
      lines: [
        { accountCode: '1300', debit: amount },
        { accountCode: '4100', credit: amount },
      ],
    });
  }

  /**
   * Create journal entry for a bill (AP)
   * Dr. Inventory/Expense (1400 - Simplified to Inventory for MVP)
   * Cr. Accounts Payable (2100)
   */
  async postBill(companyId: string, billNumber: string, amount: number): Promise<JournalEntry> {
    return this.resolveAndCreate(companyId, {
      reference: `Bill: ${billNumber}`,
      memo: `Auto-generated from bill ${billNumber}`,
      lines: [
        { accountCode: '1400', debit: amount },
        { accountCode: '2100', credit: amount },
      ],
    });
  }

  /**
   * Create journal entry for a payment received
   * Dr. Cash/Bank
   * Cr. Accounts Receivable (1300)
   */
  async postPaymentReceived(
    companyId: string,
    invoiceNumber: string,
    amount: number,
    method: string
  ): Promise<JournalEntry> {
    const cashAccount = method === 'BANK_TRANSFER' ? '1200' : '1100'; // Bank or Cash
    return this.resolveAndCreate(companyId, {
      reference: `Payment received: ${invoiceNumber}`,
      memo: `Payment via ${method}`,
      lines: [
        { accountCode: cashAccount, debit: amount },
        { accountCode: '1300', credit: amount },
      ],
    });
  }

  /**
   * Create journal entry for a payment made (bill payment)
   * Dr. Accounts Payable (2100)
   * Cr. Cash/Bank
   */
  async postPaymentMade(
    companyId: string,
    billNumber: string,
    amount: number,
    method: string
  ): Promise<JournalEntry> {
    const cashAccount = method === 'BANK_TRANSFER' ? '1200' : '1100';
    return this.resolveAndCreate(companyId, {
      reference: `Payment made: ${billNumber}`,
      memo: `Payment via ${method}`,
      lines: [
        { accountCode: '2100', debit: amount },
        { accountCode: cashAccount, credit: amount },
      ],
    });
  }

  /**
   * Create journal entry for Sales Shipment (COGS)
   * Dr. COGS (5000)
   * Cr. Inventory Asset (1400)
   */
  async postShipment(companyId: string, reference: string, amount: number): Promise<JournalEntry> {
    return this.resolveAndCreate(companyId, {
      reference,
      memo: 'Auto-generated COGS from Shipment',
      lines: [
        { accountCode: '5000', debit: amount },
        { accountCode: '1400', credit: amount },
      ],
    });
  }

  /**
   * Create journal entry for Sales Return
   * Dr. Inventory Asset (1400)
   * Cr. COGS (5000)
   */
  async postSalesReturn(
    companyId: string,
    reference: string,
    amount: number
  ): Promise<JournalEntry> {
    return this.resolveAndCreate(companyId, {
      reference,
      memo: 'Auto-generated reversal from Sales Return',
      lines: [
        { accountCode: '1400', debit: amount },
        { accountCode: '5000', credit: amount },
      ],
    });
  }

  /**
   * Create journal entry for Stock Adjustment
   * Loss: Dr. Inventory Adjustment (5200) / Cr. Inventory Asset (1400)
   * Gain: Dr. Inventory Asset (1400) / Cr. Inventory Adjustment (5200)
   */
  async postAdjustment(
    companyId: string,
    reference: string,
    amount: number,
    isLoss: boolean
  ): Promise<JournalEntry> {
    const memo = isLoss ? 'Stock Loss/Shrinkage' : 'Stock Gain/Found';
    // If Loss: Dr Expense (5200), Cr Asset (1400)
    // If Gain: Dr Asset (1400), Cr Revenue/Contra (5200)

    return this.resolveAndCreate(companyId, {
      reference,
      memo,
      lines: isLoss
        ? [
            { accountCode: '5200', debit: amount },
            { accountCode: '1400', credit: amount },
          ]
        : [
            { accountCode: '1400', debit: amount },
            { accountCode: '5200', credit: amount },
          ],
    });
  }
}
