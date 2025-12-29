import {
  JournalEntry,
  JournalSourceType,
  PaymentMethod,
  Prisma,
} from '@sync-erp/database';
import {
  BusinessDate,
  DomainError,
  DomainErrorCodes,
} from '@sync-erp/shared';
import { JournalRepository } from '../repositories/journal.repository';
import { AccountService } from './account.service';

export interface CreateJournalLineInput {
  accountId: string;
  debit: number;
  credit: number;
}

export interface CreateJournalEntryInput {
  date?: string | Date;
  reference?: string;
  memo?: string;
  sourceType?: JournalSourceType;
  sourceId?: string;
  lines: CreateJournalLineInput[];
}

/**
 * JournalService - Central service for all journal entries
 *
 * Organized into sections:
 * - Core Methods: create, reverse, getById, list, resolveAndCreate
 * - O2C (Sales) Journals: invoice, creditNote, paymentReceived, shipment, customerDeposit
 * - P2P (Procurement) Journals: bill, debitNote, paymentMade, goodsReceipt, upfrontPayment
 * - Inventory Journals: adjustment
 */
export class JournalService {
  private repository = new JournalRepository();
  private accountService = new AccountService();

  // ==========================================
  // CORE METHODS
  // ==========================================

  async reverse(
    companyId: string,
    journalId: string,
    reason?: string,
    tx?: Prisma.TransactionClient
  ): Promise<JournalEntry> {
    const original = await this.repository.findById(
      journalId,
      companyId,
      tx
    );
    if (!original) {
      throw new DomainError(
        'Journal entry not found',
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }

    const reversalLines: CreateJournalLineInput[] =
      original.lines.map((line) => ({
        accountId: line.accountId,
        debit: Number(line.credit), // Swap
        credit: Number(line.debit), // Swap
      }));

    return this.create(
      companyId,
      {
        date: new Date(),
        reference: `Reversal: ${original.reference || journalId}`,
        memo: reason || `Reversal of journal ${journalId}`,
        lines: reversalLines,
      },
      tx
    );
  }

  async create(
    companyId: string,
    data: CreateJournalEntryInput,
    tx?: Prisma.TransactionClient
  ): Promise<JournalEntry> {
    // Validate: debits must equal credits
    const totalDebit = data.lines.reduce(
      (sum, l) => sum + (l.debit || 0),
      0
    );
    const totalCredit = data.lines.reduce(
      (sum, l) => sum + (l.credit || 0),
      0
    );

    // Allow small floating point error
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new DomainError(
        `Journal entry is unbalanced. Debits: ${totalDebit}, Credits: ${totalCredit}`,
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }

    // Verify accounts exist and prepare lines
    const lineData: Prisma.JournalLineUncheckedCreateWithoutJournalInput[] =
      [];
    for (const line of data.lines) {
      let account;
      if (tx) {
        account = await tx.account.findUnique({
          where: { id: line.accountId },
        });
        if (account && account.companyId !== companyId)
          account = null;
      } else {
        account = await this.accountService.getById(
          line.accountId,
          companyId
        );
      }

      if (!account) {
        throw new DomainError(
          `Account not found: ${line.accountId}`,
          404,
          DomainErrorCodes.NOT_FOUND
        );
      }
      lineData.push({
        accountId: account.id,
        debit: line.debit || 0,
        credit: line.credit || 0,
      });
    }

    const journalDate = data.date ? new Date(data.date) : new Date();

    // Phase 1 Guard: Backdated check
    BusinessDate.from(journalDate).ensureNotBackdated();

    const createData: Prisma.JournalEntryUncheckedCreateInput = {
      companyId,
      reference: data.reference,
      date: journalDate,
      memo: data.memo,
      sourceType: data.sourceType,
      sourceId: data.sourceId,
      lines: {
        create: lineData,
      },
    };

    return this.repository.create(createData, tx);
  }

  async getById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient
  ) {
    return this.repository.findById(id, companyId, tx);
  }

  async list(
    companyId: string,
    startDate?: Date,
    endDate?: Date,
    tx?: Prisma.TransactionClient
  ) {
    return this.repository.findAll(companyId, startDate, endDate, tx);
  }

  // ============================================
  // Auto-Posting Helpers (Internal)
  // ============================================

  public async resolveAndCreate(
    companyId: string,
    data: {
      reference: string;
      memo: string;
      date?: Date;
      sourceType?: JournalSourceType;
      sourceId?: string;
      lines: {
        accountCode: string;
        debit?: number;
        credit?: number;
      }[];
    },
    tx?: Prisma.TransactionClient
  ) {
    const resolvedLines: CreateJournalLineInput[] = [];
    for (const line of data.lines) {
      let acc;
      if (tx) {
        acc = await tx.account.findUnique({
          where: {
            companyId_code: { companyId, code: line.accountCode },
          },
        });
      } else {
        acc = await this.accountService.getByCode(
          companyId,
          line.accountCode
        );
      }

      if (!acc) {
        throw new DomainError(
          `System Account code ${line.accountCode} not found. Please seed defaults.`,
          404,
          DomainErrorCodes.NOT_FOUND
        );
      }
      resolvedLines.push({
        accountId: acc.id,
        debit: line.debit || 0,
        credit: line.credit || 0,
      });
    }

    return this.create(
      companyId,
      {
        date: data.date,
        reference: data.reference,
        memo: data.memo,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        lines: resolvedLines,
      },
      tx
    );
  }

  // ==========================================
  // O2C (ORDER-TO-CASH) JOURNALS
  // Invoice, Credit Note, Payment Received, Shipment
  // ==========================================

  async postInvoice(
    companyId: string,
    invoiceId: string,
    invoiceNumber: string,
    amount: number,
    subtotal?: number,
    taxAmount?: number,
    tx?: Prisma.TransactionClient,
    businessDate?: Date
  ) {
    const lines: {
      accountCode: string;
      debit?: number;
      credit?: number;
    }[] = [
      { accountCode: '1300', debit: amount }, // Accounts Receivable
    ];

    if (taxAmount && taxAmount > 0) {
      lines.push({
        accountCode: '4100',
        credit: subtotal || amount - taxAmount,
      }); // Sales Revenue
      lines.push({ accountCode: '2300', credit: taxAmount }); // VAT Payable
    } else {
      lines.push({ accountCode: '4100', credit: amount });
    }

    return this.resolveAndCreate(
      companyId,
      {
        reference: `Invoice: ${invoiceNumber}`,
        memo: `Auto-generated from invoice ${invoiceNumber}`,
        sourceType: JournalSourceType.INVOICE,
        sourceId: invoiceId,
        lines,
        date: businessDate,
      },
      tx
    );
  }

  /**
   * Reverse Invoice Journal Entry (for void Invoice)
   * Reverses: Credit AR, Debit Sales Revenue (and VAT if applicable)
   */
  async postInvoiceReversal(
    companyId: string,
    invoiceId: string,
    invoiceNumber: string,
    amount: number,
    subtotal?: number,
    taxAmount?: number,
    tx?: Prisma.TransactionClient
  ) {
    const lines: {
      accountCode: string;
      debit?: number;
      credit?: number;
    }[] = [
      { accountCode: '1300', credit: amount }, // Reverse Accounts Receivable
    ];

    if (taxAmount && taxAmount > 0) {
      lines.push({
        accountCode: '4100',
        debit: subtotal || amount - taxAmount,
      }); // Reverse Sales Revenue
      lines.push({ accountCode: '2300', debit: taxAmount }); // Reverse VAT Payable
    } else {
      lines.push({ accountCode: '4100', debit: amount }); // Reverse Sales Revenue
    }

    return this.resolveAndCreate(
      companyId,
      {
        reference: `Invoice Reversal: ${invoiceNumber}`,
        memo: `Reversal of voided invoice ${invoiceNumber}`,
        sourceType: JournalSourceType.INVOICE,
        sourceId: invoiceId,
        lines,
      },
      tx
    );
  }

  async postCreditNote(
    companyId: string,
    creditNoteId: string,
    invoiceNumber: string,
    amount: number,
    subtotal?: number,
    taxAmount?: number,
    tx?: Prisma.TransactionClient,
    businessDate?: Date
  ) {
    const lines: {
      accountCode: string;
      debit?: number;
      credit?: number;
    }[] = [
      { accountCode: '1300', credit: amount }, // Credit AR (reduce debt)
    ];

    if (taxAmount && taxAmount > 0) {
      lines.push({
        accountCode: '4100',
        debit: subtotal || amount - taxAmount,
      }); // Reduct Sales Revenue
      lines.push({ accountCode: '2300', debit: taxAmount }); // Reduct VAT Payable
    } else {
      lines.push({ accountCode: '4100', debit: amount });
    }

    return this.resolveAndCreate(
      companyId,
      {
        reference: `Credit Note: ${invoiceNumber}`,
        memo: `Reversal for invoice ${invoiceNumber}`,
        sourceType: JournalSourceType.CREDIT_NOTE,
        sourceId: creditNoteId,
        lines,
        date: businessDate,
      },
      tx
    );
  }

  /**
   * Post Debit Note Journal (P2P returns/credits)
   * Issued by buyer to claim credit from supplier
   * Dr 2100 (AP - reduce liability), Cr 2105 (Accrual) or 5200 (Purchase Returns)
   */
  async postDebitNote(
    companyId: string,
    debitNoteId: string,
    billNumber: string,
    amount: number,
    subtotal?: number,
    taxAmount?: number,
    tx?: Prisma.TransactionClient,
    businessDate?: Date
  ) {
    const lines: {
      accountCode: string;
      debit?: number;
      credit?: number;
    }[] = [
      { accountCode: '2100', debit: amount }, // Debit AP (reduce liability)
    ];

    if (taxAmount && taxAmount > 0) {
      lines.push({
        accountCode: '2105',
        credit: subtotal || amount - taxAmount,
      }); // Reverse Accrual
      lines.push({ accountCode: '1500', credit: taxAmount }); // Reverse VAT Receivable
    } else {
      lines.push({ accountCode: '2105', credit: amount }); // Reverse Accrual
    }

    return this.resolveAndCreate(
      companyId,
      {
        reference: `Debit Note: ${billNumber}`,
        memo: `Debit note for bill ${billNumber}`,
        sourceType: JournalSourceType.CREDIT_NOTE,
        sourceId: debitNoteId,
        lines,
        date: businessDate,
      },
      tx
    );
  }

  async postGoodsReceipt(
    companyId: string,
    reference: string,
    amount: number,
    tx?: Prisma.TransactionClient
  ) {
    return this.resolveAndCreate(
      companyId,
      {
        reference,
        memo: 'Auto-generated Accrual from Goods Receipt',
        lines: [
          { accountCode: '1400', debit: amount }, // Asset
          { accountCode: '2105', credit: amount }, // Liability Suspense
        ],
      },
      tx
    );
  }

  /**
   * Reverse Goods Receipt Journal Entry (for void GRN)
   * Reverses the accrual (Credit Asset, Debit Liability)
   */
  async postGoodsReceiptReversal(
    companyId: string,
    reference: string,
    amount: number,
    tx?: Prisma.TransactionClient
  ) {
    return this.resolveAndCreate(
      companyId,
      {
        reference,
        memo: 'Reversal of Goods Receipt Accrual',
        lines: [
          { accountCode: '1400', credit: amount }, // Reverse Asset
          { accountCode: '2105', debit: amount }, // Reverse Liability Suspense
        ],
      },
      tx
    );
  }

  // ==========================================
  // P2P (PROCURE-TO-PAY) JOURNALS
  // Bill, Debit Note, Payment Made, Goods Receipt
  // ==========================================

  async postBill(
    companyId: string,
    billId: string,
    billNumber: string,
    amount: number,
    subtotal?: number,
    taxAmount?: number,
    tx?: Prisma.TransactionClient,
    businessDate?: Date
  ) {
    const lines: {
      accountCode: string;
      debit?: number;
      credit?: number;
    }[] = [
      { accountCode: '2100', credit: amount }, // Accounts Payable
    ];

    if (taxAmount && taxAmount > 0) {
      lines.push({
        accountCode: '2105',
        debit: subtotal || amount - taxAmount,
      }); // Clear Accrual
      lines.push({ accountCode: '1500', debit: taxAmount }); // VAT Receivable
    } else {
      lines.push({ accountCode: '2105', debit: amount }); // Clear Accrual
    }

    return this.resolveAndCreate(
      companyId,
      {
        reference: `Bill: ${billNumber}`,
        memo: `Auto-generated from bill ${billNumber}`,
        sourceType: JournalSourceType.BILL,
        sourceId: billId,
        lines,
        date: businessDate,
      },
      tx
    );
  }

  /**
   * Reverse Bill Journal Entry (for void Bill)
   * Reverses: Debit AP, Credit Accrual (and VAT if applicable)
   */
  async postBillReversal(
    companyId: string,
    billId: string,
    billNumber: string,
    amount: number,
    subtotal?: number,
    taxAmount?: number,
    tx?: Prisma.TransactionClient
  ) {
    const lines: {
      accountCode: string;
      debit?: number;
      credit?: number;
    }[] = [
      { accountCode: '2100', debit: amount }, // Reverse Accounts Payable
    ];

    if (taxAmount && taxAmount > 0) {
      lines.push({
        accountCode: '2105',
        credit: subtotal || amount - taxAmount,
      }); // Reverse Accrual
      lines.push({ accountCode: '1500', credit: taxAmount }); // Reverse VAT Receivable
    } else {
      lines.push({ accountCode: '2105', credit: amount }); // Reverse Accrual
    }

    return this.resolveAndCreate(
      companyId,
      {
        reference: `Bill Reversal: ${billNumber}`,
        memo: `Reversal of voided bill ${billNumber}`,
        sourceType: JournalSourceType.BILL,
        sourceId: `${billId}:reversal`,
        lines,
      },
      tx
    );
  }

  async postPaymentReceived(
    companyId: string,
    paymentId: string,
    invoiceNumber: string,
    amount: number,
    method: string,
    tx?: Prisma.TransactionClient,
    businessDate?: Date
  ) {
    const cashAccount =
      method === PaymentMethod.BANK_TRANSFER ? '1200' : '1100'; // Bank or Cash
    return this.resolveAndCreate(
      companyId,
      {
        reference: `Payment received: ${invoiceNumber}`,
        memo: `Payment via ${method}`,
        sourceType: JournalSourceType.PAYMENT,
        sourceId: paymentId,
        lines: [
          { accountCode: cashAccount, debit: amount },
          { accountCode: '1300', credit: amount },
        ],
        date: businessDate,
      },
      tx
    );
  }

  /**
   * Reverse Payment Received Journal Entry (for void Payment on Invoice AR)
   * Reverses: Debit AR, Credit Cash
   */
  async postPaymentReceivedReversal(
    companyId: string,
    paymentId: string,
    invoiceNumber: string,
    amount: number,
    method: string,
    tx?: Prisma.TransactionClient
  ) {
    const cashAccount =
      method === PaymentMethod.BANK_TRANSFER ? '1200' : '1100';
    return this.resolveAndCreate(
      companyId,
      {
        reference: `Payment Reversal: ${invoiceNumber}`,
        memo: `Reversal of voided payment`,
        sourceType: JournalSourceType.PAYMENT,
        sourceId: `${paymentId}:reversal`, // Unique ID for reversal
        lines: [
          { accountCode: '1300', debit: amount }, // Restore AR
          { accountCode: cashAccount, credit: amount }, // Reverse Cash
        ],
      },
      tx
    );
  }

  /**
   * Reverse Payment Made Journal Entry (for void Payment on Bill AP)
   * Reverses: Credit AP, Debit Cash
   */
  async postPaymentMadeReversal(
    companyId: string,
    paymentId: string,
    billNumber: string,
    amount: number,
    method: string,
    tx?: Prisma.TransactionClient
  ) {
    const cashAccount =
      method === PaymentMethod.BANK_TRANSFER ? '1200' : '1100';
    return this.resolveAndCreate(
      companyId,
      {
        reference: `Bill Payment Reversal: ${billNumber}`,
        memo: `Reversal of voided payment`,
        sourceType: JournalSourceType.PAYMENT,
        sourceId: `${paymentId}:reversal`, // Unique ID for reversal
        lines: [
          { accountCode: cashAccount, debit: amount }, // Restore Cash
          { accountCode: '2100', credit: amount }, // Restore AP
        ],
      },
      tx
    );
  }

  async postPaymentMade(
    companyId: string,
    paymentId: string,
    billNumber: string,
    amount: number,
    method: string,
    tx?: Prisma.TransactionClient
  ) {
    const cashAccount =
      method === PaymentMethod.BANK_TRANSFER ? '1200' : '1100';
    return this.resolveAndCreate(
      companyId,
      {
        reference: `Payment made: ${billNumber}`,
        memo: `Payment via ${method}`,
        sourceType: JournalSourceType.PAYMENT,
        sourceId: paymentId,
        lines: [
          { accountCode: '2100', debit: amount },
          { accountCode: cashAccount, credit: amount },
        ],
      },
      tx
    );
  }

  async postShipment(
    companyId: string,
    reference: string,
    amount: number,
    tx?: Prisma.TransactionClient
  ) {
    return this.resolveAndCreate(
      companyId,
      {
        reference,
        memo: 'Auto-generated COGS from Shipment',
        lines: [
          { accountCode: '5000', debit: amount },
          { accountCode: '1400', credit: amount },
        ],
      },
      tx
    );
  }

  async postSalesReturn(
    companyId: string,
    reference: string,
    amount: number,
    tx?: Prisma.TransactionClient
  ) {
    return this.resolveAndCreate(
      companyId,
      {
        reference,
        memo: 'Auto-generated reversal from Sales Return',
        lines: [
          { accountCode: '1400', debit: amount },
          { accountCode: '5000', credit: amount },
        ],
      },
      tx
    );
  }

  // ==========================================
  // INVENTORY JOURNALS
  // Stock Adjustments
  // ==========================================

  async postAdjustment(
    companyId: string,
    reference: string,
    amount: number,
    isLoss: boolean,
    tx?: Prisma.TransactionClient
  ) {
    const memo = isLoss ? 'Stock Loss/Shrinkage' : 'Stock Gain/Found';
    // If Loss: Dr Expense (5200), Cr Asset (1400)
    // If Gain: Dr Asset (1400), Cr Revenue/Contra (5200)

    const lines = isLoss
      ? [
          { accountCode: '5200', debit: amount },
          { accountCode: '1400', credit: amount },
        ]
      : [
          { accountCode: '1400', debit: amount },
          { accountCode: '5200', credit: amount },
        ];

    return this.resolveAndCreate(
      companyId,
      {
        reference,
        memo,
        lines,
      },
      tx
    );
  }

  /**
   * Reverse Shipment COGS Journal Entry (for void Shipment)
   * Reverses: Debit Asset (1400), Credit COGS (5000)
   */
  async postShipmentReversal(
    companyId: string,
    reference: string,
    amount: number,
    tx?: Prisma.TransactionClient
  ) {
    return this.resolveAndCreate(
      companyId,
      {
        reference,
        memo: 'Reversal of Shipment COGS',
        lines: [
          { accountCode: '1400', debit: amount }, // Restore Asset
          { accountCode: '5000', credit: amount }, // Reverse COGS
        ],
      },
      tx
    );
  }

  // ==========================================
  // Feature 036: Cash Upfront Payment
  // ==========================================

  /**
   * T028: Post Upfront Payment Journal
   * FR-006: Dr 1600 (Advances to Supplier), Cr Cash/Bank
   */
  async postUpfrontPayment(
    companyId: string,
    paymentId: string,
    orderNumber: string,
    amount: number,
    method: string,
    tx?: Prisma.TransactionClient,
    businessDate?: Date
  ) {
    const cashAccount =
      method === PaymentMethod.BANK_TRANSFER ? '1200' : '1100';
    return this.resolveAndCreate(
      companyId,
      {
        reference: `Upfront Payment: PO ${orderNumber}`,
        memo: `Advance payment to supplier via ${method}`,
        sourceType: JournalSourceType.PAYMENT,
        sourceId: paymentId,
        lines: [
          { accountCode: '1600', debit: amount }, // Advances to Supplier (Asset)
          { accountCode: cashAccount, credit: amount }, // Cash/Bank (Asset)
        ],
        date: businessDate,
      },
      tx
    );
  }

  /**
   * Post Settlement of Prepaid against AP
   * FR-010: Dr 2100 (AP), Cr 1600 (Advances to Supplier)
   * Note: Uses unique sourceId to avoid conflict with upfront payment journal
   */
  async postSettlePrepaid(
    companyId: string,
    paymentId: string,
    billNumber: string,
    amount: number,
    tx?: Prisma.TransactionClient
  ) {
    return this.resolveAndCreate(
      companyId,
      {
        reference: `Settle Prepaid: Bill ${billNumber}`,
        memo: `Settlement of supplier advance against bill`,
        sourceType: JournalSourceType.PAYMENT,
        sourceId: `${paymentId}:settlement`, // Unique ID for settlement
        lines: [
          { accountCode: '2100', debit: amount }, // Reduce Accounts Payable
          { accountCode: '1600', credit: amount }, // Clear Advances to Supplier
        ],
      },
      tx
    );
  }

  // ==========================================
  // Cash Upfront Sales - Customer Deposits
  // ==========================================

  /**
   * Post Customer Deposit Journal (Sales Upfront)
   * Dr Cash/Bank (Asset), Cr 2200 Customer Deposits (Liability)
   */
  async postCustomerDeposit(
    companyId: string,
    paymentId: string,
    orderNumber: string,
    amount: number,
    method: string,
    tx?: Prisma.TransactionClient,
    businessDate?: Date
  ) {
    const cashAccount =
      method === PaymentMethod.BANK_TRANSFER ? '1200' : '1100';
    return this.resolveAndCreate(
      companyId,
      {
        reference: `Customer Deposit: SO ${orderNumber}`,
        memo: `Customer advance payment via ${method}`,
        sourceType: JournalSourceType.PAYMENT,
        sourceId: paymentId,
        lines: [
          { accountCode: cashAccount, debit: amount }, // Cash/Bank (Asset)
          { accountCode: '2200', credit: amount }, // Customer Deposits (Liability)
        ],
        date: businessDate,
      },
      tx
    );
  }

  /**
   * Post Settlement of Customer Deposit against AR
   * Dr 2200 (Customer Deposits), Cr 1300 (Accounts Receivable)
   * Note: Uses unique sourceId to avoid conflict with deposit payment journal
   */
  async postSettleCustomerDeposit(
    companyId: string,
    paymentId: string,
    invoiceNumber: string,
    amount: number,
    tx?: Prisma.TransactionClient
  ) {
    return this.resolveAndCreate(
      companyId,
      {
        reference: `Settle Deposit: Invoice ${invoiceNumber}`,
        memo: `Settlement of customer deposit against invoice`,
        sourceType: JournalSourceType.PAYMENT,
        sourceId: `${paymentId}:settlement`, // Unique ID for settlement
        lines: [
          { accountCode: '2200', debit: amount }, // Clear Customer Deposits
          { accountCode: '1300', credit: amount }, // Reduce Accounts Receivable
        ],
      },
      tx
    );
  }
}
