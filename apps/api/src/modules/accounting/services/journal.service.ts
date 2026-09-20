import {
  JournalEntry,
  JournalSourceType,
  Prisma,
} from '@sync-erp/database';
import {
  JournalCoreService,
  CreateJournalEntryInput,
  CreateJournalLineInput,
} from './journal-core.service.js';
import { JournalRepository } from '../repositories/journal.repository.js';
import { AccountService } from './account.service.js';
import { JournalSalesService } from './journal-sales.service.js';
import { JournalProcurementService } from './journal-procurement.service.js';
import {
  JournalRentalService,
  PostRentalDownPaymentParams,
  PostRentalReleaseSettlementParams,
  PostRentalExtensionParams,
  PostRentalDamageFeeParams,
  PostRentalLateFeeParams,
  PostRentalCancellationRefundParams,
} from './journal-rental.service.js';
import { JournalInventoryService } from './journal-inventory.service.js';

/**
 * Journal Service (Facade)
 *
 * Central entry point for all journal operations, delegating to domain-specific services:
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

  reverse(companyId: string, journalId: string, reason?: string, tx?: Prisma.TransactionClient, reversalDate?: Date) {
    return this.core.reverse(companyId, journalId, reason, tx, reversalDate);
  }

  create(companyId: string, data: CreateJournalEntryInput, tx?: Prisma.TransactionClient) {
    return this.core.create(companyId, data, tx);
  }

  getById(id: string, companyId: string, tx?: Prisma.TransactionClient) {
    return this.core.getById(id, companyId, tx);
  }

  list(companyId: string, startDate?: Date, endDate?: Date, tx?: Prisma.TransactionClient) {
    return this.core.list(companyId, startDate, endDate, tx);
  }

  getAccountBalance(accountId: string, tx?: Prisma.TransactionClient) {
    return this.core.getAccountBalance(accountId, tx);
  }

  resolveAndCreate(
    companyId: string,
    data: {
      reference: string;
      memo: string;
      date?: Date;
      sourceType?: JournalSourceType;
      sourceId?: string;
      lines: { accountCode: string; debit?: number; credit?: number }[];
    },
    tx?: Prisma.TransactionClient
  ) {
    return this.core.resolveAndCreate(companyId, data, tx);
  }

  // ==========================================
  // SALES (O2C) JOURNALS (Delegated)
  // ==========================================

  postInvoice(companyId: string, invoiceId: string, invoiceNumber: string, amount: number, subtotal?: number, taxAmount?: number, tx?: Prisma.TransactionClient, businessDate?: Date) {
    return this.sales.postInvoice(companyId, invoiceId, invoiceNumber, amount, subtotal, taxAmount, tx, businessDate);
  }

  postInvoiceReversal(companyId: string, invoiceId: string, invoiceNumber: string, amount: number, subtotal?: number, taxAmount?: number, tx?: Prisma.TransactionClient) {
    return this.sales.postInvoiceReversal(companyId, invoiceId, invoiceNumber, amount, subtotal, taxAmount, tx);
  }

  postCreditNote(companyId: string, creditNoteId: string, invoiceNumber: string, amount: number, subtotal?: number, taxAmount?: number, tx?: Prisma.TransactionClient, businessDate?: Date) {
    return this.sales.postCreditNote(companyId, creditNoteId, invoiceNumber, amount, subtotal, taxAmount, tx, businessDate);
  }

  postPaymentReceived(companyId: string, paymentId: string, invoiceNumber: string, amount: number, method: string, contraAccountCode?: string, tx?: Prisma.TransactionClient, businessDate?: Date) {
    return this.sales.postPaymentReceived(companyId, paymentId, invoiceNumber, amount, method, contraAccountCode, tx, businessDate);
  }

  postPaymentReceivedReversal(companyId: string, paymentId: string, invoiceNumber: string, amount: number, method: string, contraAccountCode?: string, tx?: Prisma.TransactionClient) {
    return this.sales.postPaymentReceivedReversal(companyId, paymentId, invoiceNumber, amount, method, contraAccountCode, tx);
  }

  postShipment(companyId: string, reference: string, amount: number, tx?: Prisma.TransactionClient) {
    return this.sales.postShipment(companyId, reference, amount, tx);
  }

  postSalesReturn(companyId: string, reference: string, amount: number, tx?: Prisma.TransactionClient) {
    return this.sales.postSalesReturn(companyId, reference, amount, tx);
  }

  postShipmentReversal(companyId: string, reference: string, amount: number, tx?: Prisma.TransactionClient) {
    return this.sales.postShipmentReversal(companyId, reference, amount, tx);
  }

  postCustomerDeposit(companyId: string, paymentId: string, orderNumber: string, amount: number, method: string, tx?: Prisma.TransactionClient, businessDate?: Date) {
    return this.sales.postCustomerDeposit(companyId, paymentId, orderNumber, amount, method, tx, businessDate);
  }

  postSettleCustomerDeposit(companyId: string, paymentId: string, invoiceNumber: string, amount: number, tx?: Prisma.TransactionClient) {
    return this.sales.postSettleCustomerDeposit(companyId, paymentId, invoiceNumber, amount, tx);
  }

  // ==========================================
  // PROCUREMENT (P2P) JOURNALS (Delegated)
  // ==========================================

  postBill(companyId: string, billId: string, billNumber: string, amount: number, subtotal?: number, taxAmount?: number, tx?: Prisma.TransactionClient, businessDate?: Date) {
    return this.procurement.postBill(companyId, billId, billNumber, amount, subtotal, taxAmount, tx, businessDate);
  }

  postBillReversal(companyId: string, billId: string, billNumber: string, amount: number, subtotal?: number, taxAmount?: number, tx?: Prisma.TransactionClient) {
    return this.procurement.postBillReversal(companyId, billId, billNumber, amount, subtotal, taxAmount, tx);
  }

  postDebitNote(companyId: string, debitNoteId: string, billNumber: string, amount: number, subtotal?: number, taxAmount?: number, tx?: Prisma.TransactionClient, businessDate?: Date) {
    return this.procurement.postDebitNote(companyId, debitNoteId, billNumber, amount, subtotal, taxAmount, tx, businessDate);
  }

  postGoodsReceipt(companyId: string, reference: string, amount: number, tx?: Prisma.TransactionClient, businessDate?: Date) {
    return this.procurement.postGoodsReceipt(companyId, reference, amount, tx, businessDate);
  }

  postGoodsReceiptReversal(companyId: string, reference: string, amount: number, tx?: Prisma.TransactionClient) {
    return this.procurement.postGoodsReceiptReversal(companyId, reference, amount, tx);
  }

  postPaymentMade(companyId: string, paymentId: string, billNumber: string, amount: number, method: string, contraAccountCode?: string, tx?: Prisma.TransactionClient, businessDate?: Date) {
    return this.procurement.postPaymentMade(companyId, paymentId, billNumber, amount, method, contraAccountCode, tx, businessDate);
  }

  postPaymentMadeReversal(companyId: string, paymentId: string, billNumber: string, amount: number, method: string, contraAccountCode?: string, tx?: Prisma.TransactionClient) {
    return this.procurement.postPaymentMadeReversal(companyId, paymentId, billNumber, amount, method, contraAccountCode, tx);
  }

  postPurchaseReturn(companyId: string, reference: string, amount: number, tx?: Prisma.TransactionClient) {
    return this.procurement.postPurchaseReturn(companyId, reference, amount, tx);
  }

  postUpfrontPayment(companyId: string, paymentId: string, orderNumber: string, amount: number, method: string, tx?: Prisma.TransactionClient, businessDate?: Date) {
    return this.procurement.postUpfrontPayment(companyId, paymentId, orderNumber, amount, method, tx, businessDate);
  }

  postSettlePrepaid(companyId: string, paymentId: string, billNumber: string, amount: number, tx?: Prisma.TransactionClient) {
    return this.procurement.postSettlePrepaid(companyId, paymentId, billNumber, amount, tx);
  }

  // ==========================================
  // INVENTORY JOURNALS (Delegated)
  // ==========================================

  postAdjustment(companyId: string, reference: string, amount: number, isLoss: boolean, tx?: Prisma.TransactionClient) {
    return this.inventory.postAdjustment(companyId, reference, amount, isLoss, tx);
  }

  // ==========================================
  // RENTAL JOURNALS (Delegated)
  // ==========================================

  postRentalDownPayment(params: PostRentalDownPaymentParams): Promise<JournalEntry> {
    return this.rental.postRentalDownPayment(params);
  }

  postRentalReleaseSettlement(params: PostRentalReleaseSettlementParams): Promise<JournalEntry> {
    return this.rental.postRentalReleaseSettlement(params);
  }

  postRentalExtension(params: PostRentalExtensionParams): Promise<JournalEntry> {
    return this.rental.postRentalExtension(params);
  }

  postRentalDamageFee(params: PostRentalDamageFeeParams): Promise<JournalEntry> {
    return this.rental.postRentalDamageFee(params);
  }

  postRentalLateFee(params: PostRentalLateFeeParams): Promise<JournalEntry> {
    return this.rental.postRentalLateFee(params);
  }

  postRentalCancellationRefund(params: PostRentalCancellationRefundParams): Promise<JournalEntry> {
    return this.rental.postRentalCancellationRefund(params);
  }

  /** @deprecated Replaced by postRentalDownPayment under Feature 045 */
  postRentalDeposit(companyId: string, depositId: string, orderNumber: string, amount: number, paymentMethod: string, tx?: Prisma.TransactionClient, businessDate?: Date) {
    return this.rental.postRentalDeposit(companyId, depositId, orderNumber, amount, paymentMethod, tx, businessDate);
  }

  /** @deprecated Replaced by postRentalReleaseSettlement under Feature 045 */
  postRentalReturn(companyId: string, returnId: string, orderNumber: string, depositAmount: number, rentalRevenue: number, depositRefund: number, paymentMethod: string, tx?: Prisma.TransactionClient, businessDate?: Date) {
    return this.rental.postRentalReturn(companyId, returnId, orderNumber, depositAmount, rentalRevenue, depositRefund, paymentMethod, tx, businessDate);
  }
}

// Re-export types for backward compatibility
export type { CreateJournalEntryInput, CreateJournalLineInput };
export type {
  PostRentalDownPaymentParams,
  PostRentalReleaseSettlementParams,
  PostRentalExtensionParams,
  PostRentalDamageFeeParams,
  PostRentalLateFeeParams,
  PostRentalCancellationRefundParams,
};
