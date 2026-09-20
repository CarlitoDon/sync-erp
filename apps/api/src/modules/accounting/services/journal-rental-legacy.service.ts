import type { JournalEntry } from '@sync-erp/database';
import { Prisma } from '@sync-erp/database';
import {
  buildLegacyRentalDepositRef,
  buildLegacyRentalReturnRef,
} from '@sync-erp/shared';
import { JournalCoreService } from './journal-core.service.js';
import { JournalAccountResolver } from './journal-account-resolver.service.js';

/* eslint-disable @sync-erp/no-hardcoded-enum */
const JournalSourceType = {
  RENTAL_DEPOSIT: 'RENTAL_DEPOSIT',
  RENTAL_RETURN: 'RENTAL_RETURN',
} as const;
/* eslint-enable @sync-erp/no-hardcoded-enum */

export class JournalRentalLegacyService {
  constructor(
    private readonly core: JournalCoreService,
    private readonly accountResolver: JournalAccountResolver
  ) {}

  /**
   * Post a legacy security deposit journal entry (credits Account 2400 - Customer Deposits).
   *
   * @deprecated Replaced by `postRentalDownPayment` under Feature 045 Down Payment model.
   * Sync ERP rentals use Down Payments credited to Account 2200 (Uang Muka Sewa), not security
   * deposits in Account 2400. Retained solely for backward compatibility with historical records.
   * @see postRentalDownPayment
   */
  async postRentalDeposit(
    companyId: string,
    depositId: string,
    orderNumber: string,
    amount: number,
    paymentMethod: string,
    tx?: Prisma.TransactionClient,
    businessDate?: Date
  ): Promise<JournalEntry> {
    const contraAccountCode =
      await this.accountResolver.resolvePaymentContraAccountCode(
        companyId,
        paymentMethod,
        tx
      );
    const data = this.prepareRentalDepositJournal(
      depositId,
      orderNumber,
      amount,
      paymentMethod,
      contraAccountCode,
      businessDate
    );
    return this.core.resolveAndCreate(companyId, data, tx);
  }

  /**
   * Post a legacy rental return settlement journal entry.
   *
   * @deprecated In Feature 045 Down Payment model, revenue is recognized upon unit release via
   * `postRentalReleaseSettlement`, and returns only post damage/late fees (`postRentalDamageFee`,
   * `postRentalLateFee`). This method is retained exclusively for historical order backfill migrations
   * in `RentalOrderHistoricalSettlementService`. Do NOT use for standard rental return workflows.
   */
  async postRentalReturn(
    companyId: string,
    returnId: string,
    orderNumber: string,
    depositAmount: number,
    rentalRevenue: number,
    depositRefund: number,
    paymentMethod: string,
    tx?: Prisma.TransactionClient,
    businessDate?: Date
  ): Promise<JournalEntry> {
    const contraAccountCode =
      await this.accountResolver.resolvePaymentContraAccountCode(
        companyId,
        paymentMethod,
        tx
      );
    const data = this.prepareRentalReturnJournal(
      returnId,
      orderNumber,
      depositAmount,
      rentalRevenue,
      depositRefund,
      paymentMethod,
      contraAccountCode,
      businessDate
    );
    return this.core.resolveAndCreate(companyId, data, tx);
  }

  private prepareRentalDepositJournal(
    depositId: string,
    orderNumber: string,
    amount: number,
    paymentMethod: string,
    contraAccountCode: string,
    businessDate?: Date
  ) {
    return {
      reference: buildLegacyRentalDepositRef(orderNumber),
      memo: `Rental deposit collected via ${paymentMethod}`,
      sourceType: JournalSourceType.RENTAL_DEPOSIT,
      sourceId: depositId,
      lines: [
        { accountCode: contraAccountCode, debit: amount }, // Cash/Bank (Asset)
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
    paymentMethod: string,
    contraAccountCode: string,
    businessDate?: Date
  ) {
    const lines: {
      accountCode: string;
      debit?: number;
      credit?: number;
    }[] = [];

    // Debit deposit liability only when a real deposit exists.
    if (depositAmount > 0) {
      lines.push({ accountCode: '2400', debit: depositAmount });
    }

    // Credit rental revenue
    if (rentalRevenue > 0) {
      lines.push({ accountCode: '4200', credit: rentalRevenue });
    }

    // If refund, credit cash (money going out)
    if (depositRefund > 0) {
      lines.push({ accountCode: contraAccountCode, credit: depositRefund });
    }

    // If damage charges exceed deposit (additional collection needed)
    const additionalCharge =
      rentalRevenue - depositAmount + depositRefund;
    if (additionalCharge > 0) {
      lines.push({
        accountCode: contraAccountCode,
        debit: additionalCharge,
      });
    }

    return {
      reference: buildLegacyRentalReturnRef(orderNumber),
      memo: `Rental return settlement via ${paymentMethod} - Revenue: ${rentalRevenue}, Refund: ${depositRefund}`,
      sourceType: JournalSourceType.RENTAL_RETURN,
      sourceId: returnId,
      date: businessDate,
      lines,
    };
  }
}
