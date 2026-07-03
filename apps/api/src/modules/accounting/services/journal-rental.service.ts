import {
  JournalSourceType,
  PaymentMethodType,
  Prisma,
<<<<<<< HEAD
  prisma,
} from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';
=======
} from '@sync-erp/database';
>>>>>>> origin/dev
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
<<<<<<< HEAD
    const contraAccountCode =
      await this.resolvePaymentContraAccountCode(
        companyId,
        paymentMethod,
        tx
      );
=======
>>>>>>> origin/dev
    const data = this.prepareRentalDepositJournal(
      depositId,
      orderNumber,
      amount,
      paymentMethod,
<<<<<<< HEAD
      contraAccountCode,
=======
>>>>>>> origin/dev
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
<<<<<<< HEAD
    tx?: Prisma.TransactionClient,
    businessDate?: Date
  ) {
    const contraAccountCode =
      await this.resolvePaymentContraAccountCode(
        companyId,
        paymentMethod,
        tx
      );
=======
    tx?: Prisma.TransactionClient
  ) {
>>>>>>> origin/dev
    const data = this.prepareRentalReturnJournal(
      returnId,
      orderNumber,
      depositAmount,
      rentalRevenue,
      depositRefund,
<<<<<<< HEAD
      paymentMethod,
      contraAccountCode,
      businessDate
=======
      paymentMethod
>>>>>>> origin/dev
    );
    return this.core.resolveAndCreate(companyId, data, tx);
  }

  // --- Helpers (Private) ---

  private prepareRentalDepositJournal(
    depositId: string,
    orderNumber: string,
    amount: number,
    paymentMethod: string,
<<<<<<< HEAD
    contraAccountCode: string,
    businessDate?: Date
  ) {
=======
    businessDate?: Date
  ) {
    const cashAccount =
      paymentMethod === PaymentMethodType.BANK ? '1200' : '1100';

>>>>>>> origin/dev
    return {
      reference: `Rental Deposit: ${orderNumber}`,
      memo: `Rental deposit collected via ${paymentMethod}`,
      sourceType: JournalSourceType.RENTAL_DEPOSIT,
      sourceId: depositId,
      lines: [
<<<<<<< HEAD
        { accountCode: contraAccountCode, debit: amount }, // Cash/Bank (Asset)
=======
        { accountCode: cashAccount, debit: amount }, // Cash/Bank (Asset)
>>>>>>> origin/dev
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
<<<<<<< HEAD
    paymentMethod: string,
    contraAccountCode: string,
    businessDate?: Date
  ) {
=======
    paymentMethod: string
  ) {
    const cashAccount =
      paymentMethod === PaymentMethodType.BANK ? '1200' : '1100';

>>>>>>> origin/dev
    const lines: {
      accountCode: string;
      debit?: number;
      credit?: number;
    }[] = [];

<<<<<<< HEAD
    // Debit deposit liability only when a real deposit exists.
    if (depositAmount > 0) {
      lines.push({ accountCode: '2400', debit: depositAmount });
    }
=======
    // Always debit the full deposit liability (clearing it)
    lines.push({ accountCode: '2400', debit: depositAmount });
>>>>>>> origin/dev

    // Credit rental revenue
    if (rentalRevenue > 0) {
      lines.push({ accountCode: '4200', credit: rentalRevenue });
    }

    // If refund, credit cash (money going out)
    if (depositRefund > 0) {
<<<<<<< HEAD
      lines.push({ accountCode: contraAccountCode, credit: depositRefund });
=======
      lines.push({ accountCode: cashAccount, credit: depositRefund });
>>>>>>> origin/dev
    }

    // If damage charges exceed deposit (additional collection needed)
    const additionalCharge =
      rentalRevenue - depositAmount + depositRefund;
    if (additionalCharge > 0) {
      // This means customer pays extra
      lines.push({
<<<<<<< HEAD
        accountCode: contraAccountCode,
=======
        accountCode: cashAccount,
>>>>>>> origin/dev
        debit: additionalCharge,
      });
    }

    return {
      reference: `Rental Return: ${orderNumber}`,
<<<<<<< HEAD
      memo: `Rental return settlement via ${paymentMethod} - Revenue: ${rentalRevenue}, Refund: ${depositRefund}`,
      sourceType: JournalSourceType.RENTAL_RETURN,
      sourceId: returnId,
      date: businessDate,
      lines,
    };
  }

  private async resolvePaymentContraAccountCode(
    companyId: string,
    method: string,
    tx?: Prisma.TransactionClient
  ): Promise<string> {
    const candidateCodes =
      method === PaymentMethodType.BANK ||
      method === PaymentMethodType.QRIS ||
      method === PaymentMethodType.EWALLET
        ? ['1211', '1200']
        : ['1000', '1100'];

    for (const code of candidateCodes) {
      const account = tx
        ? await tx.account.findUnique({
            where: { companyId_code: { companyId, code } },
          })
        : await prisma.account.findUnique({
            where: { companyId_code: { companyId, code } },
          });

      if (account && isValidPaymentContraAccount(method, account.name)) {
        return account.code;
      }
    }

    throw new DomainError(
      `No valid settlement account found for ${method} payment`,
      400,
      DomainErrorCodes.INVALID_INPUT
    );
  }
}

function isValidPaymentContraAccount(method: string, accountName: string) {
  const normalized = accountName.toLowerCase();
  if (
    normalized.includes('inventory') ||
    normalized.includes('receivable')
  ) {
    return false;
  }

  if (
    method === PaymentMethodType.BANK ||
    method === PaymentMethodType.QRIS ||
    method === PaymentMethodType.EWALLET
  ) {
    return normalized.includes('bank');
  }

  return normalized.includes('cash');
=======
      memo: `Rental return settlement - Revenue: ${rentalRevenue}, Refund: ${depositRefund}`,
      sourceType: JournalSourceType.RENTAL_RETURN,
      sourceId: returnId,
      lines,
    };
  }
>>>>>>> origin/dev
}
