import { JournalSourceType, PaymentMethod } from '@sync-erp/database';

export class JournalRentalService {
  /**
   * Post Rental Deposit Journal when deposit is collected on order confirmation
   * Dr Cash/Bank (1100/1200), Cr Customer Deposits (2400) - Liability
   */
  prepareRentalDepositJournal(
    depositId: string,
    orderNumber: string,
    amount: number,
    paymentMethod: string,
    businessDate?: Date
  ) {
    const cashAccount =
      paymentMethod === PaymentMethod.BANK_TRANSFER ? '1200' : '1100';

    return {
      reference: `Rental Deposit: ${orderNumber}`,
      memo: `Rental deposit collected via ${paymentMethod}`,
      sourceType: JournalSourceType.RENTAL_DEPOSIT,
      sourceId: depositId,
      lines: [
        { accountCode: cashAccount, debit: amount }, // Cash/Bank (Asset)
        { accountCode: '2400', credit: amount }, // Customer Deposits (Liability)
      ],
      date: businessDate,
    };
  }

  /**
   * Post Rental Return Journal when return is finalized
   * Clears deposit liability and recognizes rental revenue
   * Dr Customer Deposits (2400), Cr Rental Revenue (4200)
   * If refund needed: Cr Cash/Bank for refund amount
   * If damage charge: Dr Cash/Bank for additional charge
   */
  prepareRentalReturnJournal(
    returnId: string,
    orderNumber: string,
    depositAmount: number,
    rentalRevenue: number,
    depositRefund: number,
    paymentMethod: string
  ) {
    const cashAccount =
      paymentMethod === PaymentMethod.BANK_TRANSFER ? '1200' : '1100';

    const lines: {
      accountCode: string;
      debit?: number;
      credit?: number;
    }[] = [];

    // Always debit the full deposit liability (clearing it)
    lines.push({ accountCode: '2400', debit: depositAmount });

    // Credit rental revenue
    if (rentalRevenue > 0) {
      lines.push({ accountCode: '4200', credit: rentalRevenue });
    }

    // If refund, credit cash (money going out)
    if (depositRefund > 0) {
      lines.push({ accountCode: cashAccount, credit: depositRefund });
    }

    // If damage charges exceed deposit (additional collection needed)
    const additionalCharge =
      rentalRevenue - depositAmount + depositRefund;
    if (additionalCharge > 0) {
      // This means customer pays extra
      lines.push({
        accountCode: cashAccount,
        debit: additionalCharge,
      });
    }

    return {
      reference: `Rental Return: ${orderNumber}`,
      memo: `Rental return settlement - Revenue: ${rentalRevenue}, Refund: ${depositRefund}`,
      sourceType: JournalSourceType.RENTAL_RETURN,
      sourceId: returnId,
      lines,
    };
  }
}
