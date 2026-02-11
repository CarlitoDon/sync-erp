import {
  JournalSourceType,
  PaymentMethodType,
  Prisma,
} from '@sync-erp/database';
import { JournalCoreService } from './journal-core.service';

export class JournalRentalService {
  constructor(private readonly core: JournalCoreService) {}

  async postRentalDeposit(
    companyId: string,
    depositId: string,
    orderNumber: string,
    amount: number,
    paymentMethod: string,
    tx?: Prisma.TransactionClient,
    businessDate?: Date
  ) {
    const data = this.prepareRentalDepositJournal(
      depositId,
      orderNumber,
      amount,
      paymentMethod,
      businessDate
    );
    return this.core.resolveAndCreate(companyId, data, tx);
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
    const data = this.prepareRentalReturnJournal(
      returnId,
      orderNumber,
      depositAmount,
      rentalRevenue,
      depositRefund,
      paymentMethod
    );
    return this.core.resolveAndCreate(companyId, data, tx);
  }

  // --- Helpers (Private) ---

  private prepareRentalDepositJournal(
    depositId: string,
    orderNumber: string,
    amount: number,
    paymentMethod: string,
    businessDate?: Date
  ) {
    const cashAccount =
      paymentMethod === PaymentMethodType.BANK ? '1200' : '1100';

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

  private prepareRentalReturnJournal(
    returnId: string,
    orderNumber: string,
    depositAmount: number,
    rentalRevenue: number,
    depositRefund: number,
    paymentMethod: string
  ) {
    const cashAccount =
      paymentMethod === PaymentMethodType.BANK ? '1200' : '1100';

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
