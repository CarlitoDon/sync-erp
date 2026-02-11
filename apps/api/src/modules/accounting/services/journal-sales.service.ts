import { JournalSourceType, PaymentMethodType } from '@sync-erp/database';

export class JournalSalesService {
  prepareInvoiceJournal(
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

  prepareInvoiceReversalJournal(
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

  prepareCreditNoteJournal(
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

  preparePaymentReceivedJournal(
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

  preparePaymentReceivedReversalJournal(
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

  prepareShipmentJournal(reference: string, amount: number) {
    return {
      reference,
      memo: 'Auto-generated COGS from Shipment',
      lines: [
        { accountCode: '5000', debit: amount },
        { accountCode: '1400', credit: amount },
      ],
    };
  }

  prepareShipmentReversalJournal(reference: string, amount: number) {
    return {
      reference,
      memo: 'Reversal of Shipment COGS',
      lines: [
        { accountCode: '1400', debit: amount }, // Restore Asset
        { accountCode: '5000', credit: amount }, // Reverse COGS
      ],
    };
  }

  prepareSalesReturnJournal(reference: string, amount: number) {
    return {
      reference,
      memo: 'Auto-generated reversal from Sales Return',
      lines: [
        { accountCode: '1400', debit: amount },
        { accountCode: '5000', credit: amount },
      ],
    };
  }

  prepareCustomerDepositJournal(
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

  prepareSettleCustomerDepositJournal(
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
