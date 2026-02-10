import {
  JournalEntry,
  JournalSourceType,
  Prisma,
} from '@sync-erp/database';
import {
  BusinessDate,
  DomainError,
  DomainErrorCodes,
  JournalLine,
} from '@sync-erp/shared';
import { JournalRepository } from '../repositories/journal.repository';
import { AccountService } from './account.service';
import { JournalSalesService } from './journal-sales.service';
import { JournalProcurementService } from './journal-procurement.service';
import { JournalRentalService } from './journal-rental.service';
import { JournalInventoryService } from './journal-inventory.service';

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
  private readonly sales: JournalSalesService;
  private readonly procurement: JournalProcurementService;
  private readonly rental: JournalRentalService;
  private readonly inventory: JournalInventoryService;

  constructor(
    private readonly repository: JournalRepository = new JournalRepository(),
    private readonly accountService: AccountService = new AccountService()
  ) {
    this.sales = new JournalSalesService();
    this.procurement = new JournalProcurementService();
    this.rental = new JournalRentalService();
    this.inventory = new JournalInventoryService();
  }

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
      original.lines.map((line: JournalLine) => ({
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

  async getAccountBalance(
    accountId: string,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const sums = await this.repository.aggregateAccountSum(
      accountId,
      undefined,
      tx
    );
    return (
      (Number(sums._sum.debit) || 0) - (Number(sums._sum.credit) || 0)
    );
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
    const data = this.sales.prepareInvoiceJournal(
      invoiceId,
      invoiceNumber,
      amount,
      subtotal,
      taxAmount,
      businessDate
    );
    return this.resolveAndCreate(companyId, data, tx);
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
    const data = this.sales.prepareInvoiceReversalJournal(
      invoiceId,
      invoiceNumber,
      amount,
      subtotal,
      taxAmount
    );
    return this.resolveAndCreate(companyId, data, tx);
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
    const data = this.sales.prepareCreditNoteJournal(
      creditNoteId,
      invoiceNumber,
      amount,
      subtotal,
      taxAmount,
      businessDate
    );
    return this.resolveAndCreate(companyId, data, tx);
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
    const data = this.procurement.prepareDebitNoteJournal(
      debitNoteId,
      billNumber,
      amount,
      subtotal,
      taxAmount,
      businessDate
    );
    return this.resolveAndCreate(companyId, data, tx);
  }

  async postGoodsReceipt(
    companyId: string,
    reference: string,
    amount: number,
    tx?: Prisma.TransactionClient
  ) {
    const data = this.procurement.prepareGoodsReceiptJournal(
      reference,
      amount
    );
    return this.resolveAndCreate(companyId, data, tx);
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
    const data = this.procurement.prepareGoodsReceiptReversalJournal(
      reference,
      amount
    );
    return this.resolveAndCreate(companyId, data, tx);
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
    const data = this.procurement.prepareBillJournal(
      billId,
      billNumber,
      amount,
      subtotal,
      taxAmount,
      businessDate
    );
    return this.resolveAndCreate(companyId, data, tx);
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
    const data = this.procurement.prepareBillReversalJournal(
      billId,
      billNumber,
      amount,
      subtotal,
      taxAmount
    );
    return this.resolveAndCreate(companyId, data, tx);
  }

  async postPaymentReceived(
    companyId: string,
    paymentId: string,
    invoiceNumber: string,
    amount: number,
    method: string,
    contraAccountCode?: string,
    tx?: Prisma.TransactionClient,
    businessDate?: Date
  ) {
    const data = this.sales.preparePaymentReceivedJournal(
      paymentId,
      invoiceNumber,
      amount,
      method,
      contraAccountCode,
      businessDate
    );
    return this.resolveAndCreate(companyId, data, tx);
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
    contraAccountCode?: string,
    tx?: Prisma.TransactionClient
  ) {
    const data = this.sales.preparePaymentReceivedReversalJournal(
      paymentId,
      invoiceNumber,
      amount,
      method,
      contraAccountCode
    );
    return this.resolveAndCreate(companyId, data, tx);
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
    contraAccountCode?: string,
    tx?: Prisma.TransactionClient
  ) {
    const data = this.procurement.preparePaymentMadeReversalJournal(
      paymentId,
      billNumber,
      amount,
      method,
      contraAccountCode
    );
    return this.resolveAndCreate(companyId, data, tx);
  }

  async postPaymentMade(
    companyId: string,
    paymentId: string,
    billNumber: string,
    amount: number,
    method: string,
    contraAccountCode?: string,
    tx?: Prisma.TransactionClient
  ) {
    const data = this.procurement.preparePaymentMadeJournal(
      paymentId,
      billNumber,
      amount,
      method,
      contraAccountCode
    );
    return this.resolveAndCreate(companyId, data, tx);
  }

  async postShipment(
    companyId: string,
    reference: string,
    amount: number,
    tx?: Prisma.TransactionClient
  ) {
    const data = this.sales.prepareShipmentJournal(reference, amount);
    return this.resolveAndCreate(companyId, data, tx);
  }

  async postSalesReturn(
    companyId: string,
    reference: string,
    amount: number,
    tx?: Prisma.TransactionClient
  ) {
    const data = this.sales.prepareSalesReturnJournal(
      reference,
      amount
    );
    return this.resolveAndCreate(companyId, data, tx);
  }

  /**
   * Post Purchase Return Journal Entry
   * Reverses GRNI accrual: Dr 2105 (GRNI Accrued), Cr 1400 (Inventory)
   * Called when goods are returned to supplier.
   */
  async postPurchaseReturn(
    companyId: string,
    reference: string,
    amount: number,
    tx?: Prisma.TransactionClient
  ) {
    const data = this.procurement.preparePurchaseReturnJournal(
      reference,
      amount
    );
    return this.resolveAndCreate(companyId, data, tx);
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
    const data = this.inventory.prepareAdjustmentJournal(
      reference,
      amount,
      isLoss
    );
    return this.resolveAndCreate(companyId, data, tx);
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
    const data = this.sales.prepareShipmentReversalJournal(
      reference,
      amount
    );
    return this.resolveAndCreate(companyId, data, tx);
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
    const data = this.procurement.prepareUpfrontPaymentJournal(
      paymentId,
      orderNumber,
      amount,
      method,
      businessDate
    );
    return this.resolveAndCreate(companyId, data, tx);
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
    const data = this.procurement.prepareSettlePrepaidJournal(
      paymentId,
      billNumber,
      amount
    );
    return this.resolveAndCreate(companyId, data, tx);
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
    const data = this.sales.prepareCustomerDepositJournal(
      paymentId,
      orderNumber,
      amount,
      method,
      businessDate
    );
    return this.resolveAndCreate(companyId, data, tx);
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
    const data = this.sales.prepareSettleCustomerDepositJournal(
      paymentId,
      invoiceNumber,
      amount
    );
    return this.resolveAndCreate(companyId, data, tx);
  }

  // ==========================================
  // RENTAL JOURNALS
  // Deposit Collection, Return Settlement
  // ==========================================

  /**
   * Post Rental Deposit Journal when deposit is collected on order confirmation
   * Dr Cash/Bank (1100/1200), Cr Customer Deposits (2400) - Liability
   */
  async postRentalDeposit(
    companyId: string,
    depositId: string,
    orderNumber: string,
    amount: number,
    paymentMethod: string,
    tx?: Prisma.TransactionClient,
    businessDate?: Date
  ) {
    const data = this.rental.prepareRentalDepositJournal(
      depositId,
      orderNumber,
      amount,
      paymentMethod,
      businessDate
    );
    return this.resolveAndCreate(companyId, data, tx);
  }

  /**
   * Post Rental Return Journal when return is finalized
   * Clears deposit liability and recognizes rental revenue
   * Dr Customer Deposits (2400), Cr Rental Revenue (4200)
   * If refund needed: Cr Cash/Bank for refund amount
   * If damage charge: Dr Cash/Bank for additional charge
   */
  async postRentalReturn(
    companyId: string,
    returnId: string,
    orderNumber: string,
    depositAmount: number,
    rentalRevenue: number,
    depositRefund: number,
    paymentMethod: string,
    tx?: Prisma.TransactionClient
  ) {
    const data = this.rental.prepareRentalReturnJournal(
      returnId,
      orderNumber,
      depositAmount,
      rentalRevenue,
      depositRefund,
      paymentMethod
    );
    return this.resolveAndCreate(companyId, data, tx);
  }
}
