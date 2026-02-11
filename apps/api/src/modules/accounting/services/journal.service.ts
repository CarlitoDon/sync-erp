import {
  JournalEntry,
  JournalSourceType,
  Prisma,
} from '@sync-erp/database';
// Use Core type which supports Date | string to avoid build errors with existing consumers
import {
  JournalCoreService,
  CreateJournalEntryInput,
  CreateJournalLineInput,
} from './journal-core.service';
import { JournalRepository } from '../repositories/journal.repository';
import { AccountService } from './account.service';
import { JournalSalesService } from './journal-sales.service';
import { JournalProcurementService } from './journal-procurement.service';
import { JournalRentalService } from './journal-rental.service';
import { JournalInventoryService } from './journal-inventory.service';

/**
 * Journal Service (Facade)
 *
 * Central entry point for all journal operations.
 * Delegates to:
 * - JournalCoreService: Core CRUD and account resolution
 * - JournalSalesService: O2C logic
 * - JournalProcurementService: P2P logic
 * - JournalRentalService: Rental logic
 * - JournalInventoryService: Inventory logic
 */
export class JournalService {
  public readonly sales: JournalSalesService;
  public readonly procurement: JournalProcurementService;
  public readonly rental: JournalRentalService;
  public readonly inventory: JournalInventoryService;
  public readonly core: JournalCoreService;

  constructor(
    repository: JournalRepository = new JournalRepository(),
    accountService: AccountService = new AccountService()
  ) {
    this.core = new JournalCoreService(repository, accountService);
    this.sales = new JournalSalesService(this.core);
    this.procurement = new JournalProcurementService(this.core);
    this.rental = new JournalRentalService(this.core);
    this.inventory = new JournalInventoryService(this.core);
  }

  // ==========================================
  // CORE METHODS (Delegated)
  // ==========================================

  async reverse(
    companyId: string,
    journalId: string,
    reason?: string,
    tx?: Prisma.TransactionClient
  ): Promise<JournalEntry> {
    return this.core.reverse(companyId, journalId, reason, tx);
  }

  async create(
    companyId: string,
    data: CreateJournalEntryInput,
    tx?: Prisma.TransactionClient
  ): Promise<JournalEntry> {
    return this.core.create(companyId, data, tx);
  }

  async getById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient
  ) {
    return this.core.getById(id, companyId, tx);
  }

  async list(
    companyId: string,
    startDate?: Date,
    endDate?: Date,
    tx?: Prisma.TransactionClient
  ) {
    return this.core.list(companyId, startDate, endDate, tx);
  }

  async getAccountBalance(
    accountId: string,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    return this.core.getAccountBalance(accountId, tx);
  }

  // NOTE: resolveAndCreate uses Core types internally
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
    return this.core.resolveAndCreate(companyId, data, tx);
  }

  // ==========================================
  // SALES (O2C) JOURNALS (Delegated)
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
    return this.sales.postInvoice(
      companyId,
      invoiceId,
      invoiceNumber,
      amount,
      subtotal,
      taxAmount,
      tx,
      businessDate
    );
  }

  async postInvoiceReversal(
    companyId: string,
    invoiceId: string,
    invoiceNumber: string,
    amount: number,
    subtotal?: number,
    taxAmount?: number,
    tx?: Prisma.TransactionClient
  ) {
    return this.sales.postInvoiceReversal(
      companyId,
      invoiceId,
      invoiceNumber,
      amount,
      subtotal,
      taxAmount,
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
    return this.sales.postCreditNote(
      companyId,
      creditNoteId,
      invoiceNumber,
      amount,
      subtotal,
      taxAmount,
      tx,
      businessDate
    );
  }

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
    return this.procurement.postDebitNote(
      companyId,
      debitNoteId,
      billNumber,
      amount,
      subtotal,
      taxAmount,
      tx,
      businessDate
    );
  }

  async postGoodsReceipt(
    companyId: string,
    reference: string,
    amount: number,
    tx?: Prisma.TransactionClient
  ) {
    return this.procurement.postGoodsReceipt(
      companyId,
      reference,
      amount,
      tx
    );
  }

  async postGoodsReceiptReversal(
    companyId: string,
    reference: string,
    amount: number,
    tx?: Prisma.TransactionClient
  ) {
    return this.procurement.postGoodsReceiptReversal(
      companyId,
      reference,
      amount,
      tx
    );
  }

  // ==========================================
  // PROCUREMENT (P2P) JOURNALS (Delegated)
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
    return this.procurement.postBill(
      companyId,
      billId,
      billNumber,
      amount,
      subtotal,
      taxAmount,
      tx,
      businessDate
    );
  }

  async postBillReversal(
    companyId: string,
    billId: string,
    billNumber: string,
    amount: number,
    subtotal?: number,
    taxAmount?: number,
    tx?: Prisma.TransactionClient
  ) {
    return this.procurement.postBillReversal(
      companyId,
      billId,
      billNumber,
      amount,
      subtotal,
      taxAmount,
      tx
    );
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
    return this.sales.postPaymentReceived(
      companyId,
      paymentId,
      invoiceNumber,
      amount,
      method,
      contraAccountCode,
      tx,
      businessDate
    );
  }

  async postPaymentReceivedReversal(
    companyId: string,
    paymentId: string,
    invoiceNumber: string,
    amount: number,
    method: string,
    contraAccountCode?: string,
    tx?: Prisma.TransactionClient
  ) {
    return this.sales.postPaymentReceivedReversal(
      companyId,
      paymentId,
      invoiceNumber,
      amount,
      method,
      contraAccountCode,
      tx
    );
  }

  async postPaymentMadeReversal(
    companyId: string,
    paymentId: string,
    billNumber: string,
    amount: number,
    method: string,
    contraAccountCode?: string,
    tx?: Prisma.TransactionClient
  ) {
    return this.procurement.postPaymentMadeReversal(
      companyId,
      paymentId,
      billNumber,
      amount,
      method,
      contraAccountCode,
      tx
    );
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
    return this.procurement.postPaymentMade(
      companyId,
      paymentId,
      billNumber,
      amount,
      method,
      contraAccountCode,
      tx
    );
  }

  async postShipment(
    companyId: string,
    reference: string,
    amount: number,
    tx?: Prisma.TransactionClient
  ) {
    return this.sales.postShipment(companyId, reference, amount, tx);
  }

  async postSalesReturn(
    companyId: string,
    reference: string,
    amount: number,
    tx?: Prisma.TransactionClient
  ) {
    return this.sales.postSalesReturn(
      companyId,
      reference,
      amount,
      tx
    );
  }

  async postPurchaseReturn(
    companyId: string,
    reference: string,
    amount: number,
    tx?: Prisma.TransactionClient
  ) {
    return this.procurement.postPurchaseReturn(
      companyId,
      reference,
      amount,
      tx
    );
  }

  // ==========================================
  // INVENTORY JOURNALS (Delegated)
  // ==========================================

  async postAdjustment(
    companyId: string,
    reference: string,
    amount: number,
    isLoss: boolean,
    tx?: Prisma.TransactionClient
  ) {
    return this.inventory.postAdjustment(
      companyId,
      reference,
      amount,
      isLoss,
      tx
    );
  }

  async postShipmentReversal(
    companyId: string,
    reference: string,
    amount: number,
    tx?: Prisma.TransactionClient
  ) {
    return this.sales.postShipmentReversal(
      companyId,
      reference,
      amount,
      tx
    );
  }

  // ==========================================
  // UPDATED: Prepaid / Deposit methods
  // ==========================================

  async postUpfrontPayment(
    companyId: string,
    paymentId: string,
    orderNumber: string,
    amount: number,
    method: string,
    tx?: Prisma.TransactionClient,
    businessDate?: Date
  ) {
    return this.procurement.postUpfrontPayment(
      companyId,
      paymentId,
      orderNumber,
      amount,
      method,
      tx,
      businessDate
    );
  }

  async postSettlePrepaid(
    companyId: string,
    paymentId: string,
    billNumber: string,
    amount: number,
    tx?: Prisma.TransactionClient
  ) {
    return this.procurement.postSettlePrepaid(
      companyId,
      paymentId,
      billNumber,
      amount,
      tx
    );
  }

  async postCustomerDeposit(
    companyId: string,
    paymentId: string,
    orderNumber: string,
    amount: number,
    method: string,
    tx?: Prisma.TransactionClient,
    businessDate?: Date
  ) {
    return this.sales.postCustomerDeposit(
      companyId,
      paymentId,
      orderNumber,
      amount,
      method,
      tx,
      businessDate
    );
  }

  async postSettleCustomerDeposit(
    companyId: string,
    paymentId: string,
    invoiceNumber: string,
    amount: number,
    tx?: Prisma.TransactionClient
  ) {
    return this.sales.postSettleCustomerDeposit(
      companyId,
      paymentId,
      invoiceNumber,
      amount,
      tx
    );
  }

  // ==========================================
  // RENTAL JOURNALS (Delegated)
  // ==========================================

  async postRentalDeposit(
    companyId: string,
    depositId: string,
    orderNumber: string,
    amount: number,
    paymentMethod: string,
    tx?: Prisma.TransactionClient,
    businessDate?: Date
  ) {
    return this.rental.postRentalDeposit(
      companyId,
      depositId,
      orderNumber,
      amount,
      paymentMethod,
      tx,
      businessDate
    );
  }

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
    return this.rental.postRentalReturn(
      companyId,
      returnId,
      orderNumber,
      depositAmount,
      rentalRevenue,
      depositRefund,
      paymentMethod,
      tx
    );
  }
}

// Re-export types for backward compatibility
export type { CreateJournalEntryInput, CreateJournalLineInput };
