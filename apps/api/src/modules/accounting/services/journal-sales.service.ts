import {
  JournalSourceType,
  PaymentMethodType,
  Prisma,
} from '@sync-erp/database';
import { JournalCoreService } from './journal-core.service';

export class JournalSalesService {
  constructor(private readonly core: JournalCoreService) {}

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
    const data = this.prepareInvoiceJournal(
      invoiceId,
      invoiceNumber,
      amount,
      subtotal,
      taxAmount,
      businessDate
    );
    return this.core.resolveAndCreate(companyId, data, tx);
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
    const data = this.prepareInvoiceReversalJournal(
      invoiceId,
      invoiceNumber,
      amount,
      subtotal,
      taxAmount
    );
    return this.core.resolveAndCreate(companyId, data, tx);
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
    const data = this.prepareCreditNoteJournal(
      creditNoteId,
      invoiceNumber,
      amount,
      subtotal,
      taxAmount,
      businessDate
    );
    return this.core.resolveAndCreate(companyId, data, tx);
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
    const data = this.preparePaymentReceivedJournal(
      paymentId,
      invoiceNumber,
      amount,
      method,
      contraAccountCode,
      businessDate
    );
    return this.core.resolveAndCreate(companyId, data, tx);
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
    const data = this.preparePaymentReceivedReversalJournal(
      paymentId,
      invoiceNumber,
      amount,
      method,
      contraAccountCode
    );
    return this.core.resolveAndCreate(companyId, data, tx);
  }

  async postShipment(
    companyId: string,
    reference: string,
    amount: number,
    tx?: Prisma.TransactionClient
  ) {
    const data = this.prepareShipmentJournal(reference, amount);
    return this.core.resolveAndCreate(companyId, data, tx);
  }

  async postShipmentReversal(
    companyId: string,
    reference: string,
    amount: number,
    tx?: Prisma.TransactionClient
  ) {
    const data = this.prepareShipmentReversalJournal(
      reference,
      amount
    );
    return this.core.resolveAndCreate(companyId, data, tx);
  }

  async postSalesReturn(
    companyId: string,
    reference: string,
    amount: number,
    tx?: Prisma.TransactionClient
  ) {
    const data = this.prepareSalesReturnJournal(reference, amount);
    return this.core.resolveAndCreate(companyId, data, tx);
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
    const data = this.prepareCustomerDepositJournal(
      paymentId,
      orderNumber,
      amount,
      method,
      businessDate
    );
    return this.core.resolveAndCreate(companyId, data, tx);
  }

  async postSettleCustomerDeposit(
    companyId: string,
    paymentId: string,
    invoiceNumber: string,
    amount: number,
    tx?: Prisma.TransactionClient
  ) {
    const data = this.prepareSettleCustomerDepositJournal(
      paymentId,
      invoiceNumber,
      amount
    );
    return this.core.resolveAndCreate(companyId, data, tx);
  }

  // --- Helpers (Private) ---

  private prepareInvoiceJournal(
    invoiceId: string,
    invoiceNumber: string,
    amount: number,
    subtotal?: number,
    taxAmount?: number,
    businessDate?: Date
  ) {
    const lines: {
      accountCode: string;
      debit?: number;
      credit?: number;
    }[] = [
      { accountCode: '1300', debit: amount }, // Accounts Receivable
    ];

    const grossItems = (subtotal || 0) + (taxAmount || 0);
    const dpDeducted = Math.max(0, grossItems - amount);

    if (dpDeducted > 0.01) {
      lines.push({ accountCode: '2200', debit: dpDeducted }); // Clear Customer Deposits
    }

    if (taxAmount && taxAmount > 0) {
      lines.push({
        accountCode: '4100',
        credit: subtotal || amount - taxAmount,
      }); // Sales Revenue
      lines.push({ accountCode: '2300', credit: taxAmount }); // VAT Payable
    } else {
      lines.push({ accountCode: '4100', credit: amount });
    }

    return {
      reference: `Invoice: ${invoiceNumber}`,
      memo: `Auto-generated from invoice ${invoiceNumber}`,
      sourceType: JournalSourceType.INVOICE,
      sourceId: invoiceId,
      lines,
      date: businessDate,
    };
  }

  private prepareInvoiceReversalJournal(
    invoiceId: string,
    invoiceNumber: string,
    amount: number,
    subtotal?: number,
    taxAmount?: number
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

    return {
      reference: `Invoice Reversal: ${invoiceNumber}`,
      memo: `Reversal of voided invoice ${invoiceNumber}`,
      sourceType: JournalSourceType.INVOICE,
      sourceId: `${invoiceId}:reversal`,
      lines,
    };
  }

  private prepareCreditNoteJournal(
    creditNoteId: string,
    invoiceNumber: string,
    amount: number,
    subtotal?: number,
    taxAmount?: number,
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

    return {
      reference: `Credit Note: ${invoiceNumber}`,
      memo: `Reversal for invoice ${invoiceNumber}`,
      sourceType: JournalSourceType.CREDIT_NOTE,
      sourceId: creditNoteId,
      lines,
      date: businessDate,
    };
  }

  private preparePaymentReceivedJournal(
    paymentId: string,
    invoiceNumber: string,
    amount: number,
    method: string,
    contraAccountCode?: string,
    businessDate?: Date
  ) {
    const cashAccount =
      contraAccountCode ||
      (method === PaymentMethodType.BANK ? '1200' : '1100'); // Bank or Cash

    return {
      reference: `Payment received: ${invoiceNumber}`,
      memo: `Payment via ${method}`,
      sourceType: JournalSourceType.PAYMENT,
      sourceId: paymentId,
      lines: [
        { accountCode: cashAccount, debit: amount },
        { accountCode: '1300', credit: amount },
      ],
      date: businessDate,
    };
  }

  private preparePaymentReceivedReversalJournal(
    paymentId: string,
    invoiceNumber: string,
    amount: number,
    method: string,
    contraAccountCode?: string
  ) {
    const cashAccount =
      contraAccountCode ||
      (method === PaymentMethodType.BANK ? '1200' : '1100');

    return {
      reference: `Payment Reversal: ${invoiceNumber}`,
      memo: `Reversal of voided payment`,
      sourceType: JournalSourceType.PAYMENT,
      sourceId: `${paymentId}:reversal`, // Unique ID for reversal
      lines: [
        { accountCode: '1300', debit: amount }, // Restore AR
        { accountCode: cashAccount, credit: amount }, // Reverse Cash
      ],
    };
  }

  private prepareShipmentJournal(reference: string, amount: number) {
    return {
      reference,
      memo: 'Auto-generated COGS from Shipment',
      lines: [
        { accountCode: '5000', debit: amount },
        { accountCode: '1400', credit: amount },
      ],
    };
  }

  private prepareShipmentReversalJournal(
    reference: string,
    amount: number
  ) {
    return {
      reference,
      memo: 'Reversal of Shipment COGS',
      lines: [
        { accountCode: '1400', debit: amount }, // Restore Asset
        { accountCode: '5000', credit: amount }, // Reverse COGS
      ],
    };
  }

  private prepareSalesReturnJournal(
    reference: string,
    amount: number
  ) {
    return {
      reference,
      memo: 'Auto-generated reversal from Sales Return',
      lines: [
        { accountCode: '1400', debit: amount },
        { accountCode: '5000', credit: amount },
      ],
    };
  }

  private prepareCustomerDepositJournal(
    paymentId: string,
    orderNumber: string,
    amount: number,
    method: string,
    businessDate?: Date
  ) {
    const cashAccount =
      method === PaymentMethodType.BANK ? '1200' : '1100';
    return {
      reference: `Customer Deposit: SO ${orderNumber}`,
      memo: `Customer advance payment via ${method}`,
      sourceType: JournalSourceType.PAYMENT,
      sourceId: paymentId,
      lines: [
        { accountCode: cashAccount, debit: amount }, // Cash/Bank (Asset)
        { accountCode: '2200', credit: amount }, // Customer Deposits (Liability)
      ],
      date: businessDate,
    };
  }

  private prepareSettleCustomerDepositJournal(
    paymentId: string,
    invoiceNumber: string,
    amount: number
  ) {
    return {
      reference: `Settle Deposit: Invoice ${invoiceNumber}`,
      memo: `Settlement of customer deposit against invoice`,
      sourceType: JournalSourceType.PAYMENT,
      sourceId: `${paymentId}:settlement`, // Unique ID for settlement
      lines: [
        { accountCode: '2200', debit: amount }, // Clear Customer Deposits
        { accountCode: '1300', credit: amount }, // Reduce Accounts Receivable
      ],
    };
  }
}
