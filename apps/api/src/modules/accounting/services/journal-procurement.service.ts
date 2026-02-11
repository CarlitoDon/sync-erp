import { JournalSourceType, PaymentMethodType } from '@sync-erp/database';

export class JournalProcurementService {
  prepareBillJournal(
    billId: string,
    billNumber: string,
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
      { accountCode: '2100', credit: amount }, // Accounts Payable (Payable portion)
    ];

    const grossItems = (subtotal || 0) + (taxAmount || 0);
    const dpDeducted = Math.max(0, grossItems - amount);

    if (dpDeducted > 0.01) {
      lines.push({ accountCode: '1600', credit: dpDeducted }); // Clear Advances to Supplier
    }

    if (taxAmount && taxAmount > 0) {
      lines.push({
        accountCode: '2105',
        debit: subtotal || 0,
      }); // Clear Accrual for full value of items
      lines.push({ accountCode: '1500', debit: taxAmount }); // VAT Receivable for full value
    } else {
      lines.push({ accountCode: '2105', debit: amount + dpDeducted }); // Clear Accrual
    }

    return {
      reference: `Bill: ${billNumber}`,
      memo: `Auto-generated from bill ${billNumber}`,
      sourceType: JournalSourceType.BILL,
      sourceId: billId,
      lines,
      date: businessDate,
    };
  }

  prepareBillReversalJournal(
    billId: string,
    billNumber: string,
    amount: number,
    subtotal?: number,
    taxAmount?: number
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

    return {
      reference: `Bill Reversal: ${billNumber}`,
      memo: `Reversal of voided bill ${billNumber}`,
      sourceType: JournalSourceType.BILL,
      sourceId: `${billId}:reversal`,
      lines,
    };
  }

  prepareDebitNoteJournal(
    debitNoteId: string,
    billNumber: string,
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

    return {
      reference: `Debit Note: ${billNumber}`,
      memo: `Debit note for bill ${billNumber}`,
      sourceType: JournalSourceType.CREDIT_NOTE,
      sourceId: debitNoteId,
      lines,
      date: businessDate,
    };
  }

  prepareGoodsReceiptJournal(reference: string, amount: number) {
    return {
      reference,
      memo: 'Auto-generated Accrual from Goods Receipt',
      lines: [
        { accountCode: '1400', debit: amount }, // Asset
        { accountCode: '2105', credit: amount }, // Liability Suspense
      ],
    };
  }

  prepareGoodsReceiptReversalJournal(
    reference: string,
    amount: number
  ) {
    return {
      reference,
      memo: 'Reversal of Goods Receipt Accrual',
      lines: [
        { accountCode: '1400', credit: amount }, // Reverse Asset
        { accountCode: '2105', debit: amount }, // Reverse Liability Suspense
      ],
    };
  }

  preparePurchaseReturnJournal(reference: string, amount: number) {
    return {
      reference,
      memo: 'Auto-generated reversal from Purchase Return',
      lines: [
        { accountCode: '2105', debit: amount }, // Reduce GRNI accrual
        { accountCode: '1400', credit: amount }, // Reduce Inventory
      ],
    };
  }

  preparePaymentMadeJournal(
    paymentId: string,
    billNumber: string,
    amount: number,
    method: string,
    contraAccountCode?: string
  ) {
    const cashAccount =
      contraAccountCode ||
      (method === PaymentMethodType.BANK ? '1200' : '1100');
    return {
      reference: `Payment made: ${billNumber}`,
      memo: `Payment via ${method}`,
      sourceType: JournalSourceType.PAYMENT,
      sourceId: paymentId,
      lines: [
        { accountCode: '2100', debit: amount },
        { accountCode: cashAccount, credit: amount },
      ],
    };
  }

  preparePaymentMadeReversalJournal(
    paymentId: string,
    billNumber: string,
    amount: number,
    method: string,
    contraAccountCode?: string
  ) {
    const cashAccount =
      contraAccountCode ||
      (method === PaymentMethodType.BANK ? '1200' : '1100');
    return {
      reference: `Bill Payment Reversal: ${billNumber}`,
      memo: `Reversal of voided payment`,
      sourceType: JournalSourceType.PAYMENT,
      sourceId: `${paymentId}:reversal`, // Unique ID for reversal
      lines: [
        { accountCode: cashAccount, debit: amount }, // Restore Cash
        { accountCode: '2100', credit: amount }, // Restore AP
      ],
    };
  }

  prepareUpfrontPaymentJournal(
    paymentId: string,
    orderNumber: string,
    amount: number,
    method: string,
    businessDate?: Date
  ) {
    const cashAccount =
      method === PaymentMethodType.BANK ? '1200' : '1100';
    return {
      reference: `Upfront Payment: PO ${orderNumber}`,
      memo: `Advance payment to supplier via ${method}`,
      sourceType: JournalSourceType.PAYMENT,
      sourceId: paymentId,
      lines: [
        { accountCode: '1600', debit: amount }, // Advances to Supplier (Asset)
        { accountCode: cashAccount, credit: amount }, // Cash/Bank (Asset)
      ],
      date: businessDate,
    };
  }

  prepareSettlePrepaidJournal(
    paymentId: string,
    billNumber: string,
    amount: number
  ) {
    return {
      reference: `Settle Prepaid: Bill ${billNumber}`,
      memo: `Settlement of supplier advance against bill`,
      sourceType: JournalSourceType.PAYMENT,
      sourceId: `${paymentId}:settlement`, // Unique ID for settlement
      lines: [
        { accountCode: '2100', debit: amount }, // Reduce Accounts Payable
        { accountCode: '1600', credit: amount }, // Clear Advances to Supplier
      ],
    };
  }
}
