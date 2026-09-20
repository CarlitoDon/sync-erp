import type {
  JournalEntry,
} from '@sync-erp/database';
import {
  Prisma,
} from '@sync-erp/database';
import {
  DomainError,
  DomainErrorCodes,
  buildRentalDpRef,
  buildRentalReleaseRef,
  buildRentalExtensionRef,
  buildRentalDamageFeeRef,
  buildRentalLateFeeRef,
  buildRentalRefundDpRef,
} from '@sync-erp/shared';
import { Decimal } from 'decimal.js';
import { JournalCoreService } from './journal-core.service.js';
import { JournalAccountResolver } from './journal-account-resolver.service.js';
import { JournalRentalLegacyService } from './journal-rental-legacy.service.js';

/* eslint-disable @sync-erp/no-hardcoded-enum -- Mock-safe enum constant for rental journal source types in unit tests */
const JournalSourceType = {
  RENTAL_DEPOSIT: 'RENTAL_DEPOSIT',
  PAYMENT: 'PAYMENT',
  RENTAL_RETURN: 'RENTAL_RETURN',
} as const;
/* eslint-enable @sync-erp/no-hardcoded-enum */

export interface PostRentalDownPaymentParams {
  companyId: string;
  orderId: string;
  orderNumber: string;
  downPaymentAmount: number;
  paymentAccountId?: string;
  paymentMethod?: string;
  customerName?: string;
  tx?: Prisma.TransactionClient;
  businessDate?: Date;
}

export interface PostRentalReleaseSettlementParams {
  companyId: string;
  orderId: string;
  orderNumber: string;
  settlementAmount: number;
  downPaymentAmount: number;
  rentalRevenueAmount: number;
  deliveryFeeAmount?: number;
  paymentAccountId?: string;
  paymentMethod?: string;
  customerName?: string;
  tx?: Prisma.TransactionClient;
  businessDate?: Date;
}

export interface PostRentalExtensionParams {
  companyId: string;
  orderId: string;
  orderNumber: string;
  extensionAmount: number;
  extraDeliveryFee?: number;
  paymentAccountId?: string;
  paymentMethod?: string;
  customerName?: string;
  reference?: string;
  sourceId?: string;
  tx?: Prisma.TransactionClient;
  businessDate?: Date;
}

export interface PostRentalDamageFeeParams {
  companyId: string;
  orderId: string;
  orderNumber: string;
  damageFeeAmount: number;
  paymentAccountId?: string;
  paymentMethod?: string;
  customerName?: string;
  tx?: Prisma.TransactionClient;
  businessDate?: Date;
}

export interface PostRentalLateFeeParams {
  companyId: string;
  orderId: string;
  orderNumber: string;
  lateFeeAmount: number;
  paymentAccountId?: string;
  paymentMethod?: string;
  customerName?: string;
  tx?: Prisma.TransactionClient;
  businessDate?: Date;
}

export interface PostRentalCancellationRefundParams {
  companyId: string;
  orderId: string;
  orderNumber: string;
  refundAmount: number;
  paymentAccountId?: string;
  paymentMethod?: string;
  customerName?: string;
  tx?: Prisma.TransactionClient;
  businessDate?: Date;
}

export class JournalRentalService {
  constructor(
    private readonly core: JournalCoreService,
    private readonly accountResolver: JournalAccountResolver = new JournalAccountResolver(),
    private readonly legacy: JournalRentalLegacyService = new JournalRentalLegacyService(
      core,
      accountResolver
    )
  ) {}

  // ==========================================
  // FEATURE 045 BALANCED PROCEDURES
  // ==========================================

  /**
   * T004: Post Down Payment (~30% DP) Journal
   * Debet: Kas / Bank (Asset)
   * Kredit: Uang Muka Sewa '2200' (Liability)
   */
  async postRentalDownPayment(
    params: PostRentalDownPaymentParams
  ): Promise<JournalEntry> {
    const {
      companyId,
      orderId,
      orderNumber,
      downPaymentAmount,
      paymentAccountId,
      paymentMethod,
      customerName,
      tx,
      businessDate,
    } = params;

    const dAmount = new Decimal(downPaymentAmount || 0);
    if (dAmount.lte(0)) {
      throw new DomainError(
        'Down payment amount must be greater than 0',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    const contraAccountCode =
      await this.accountResolver.resolveCashBankAccountCode(
        companyId,
        paymentAccountId,
        paymentMethod,
        tx
      );

    const data = {
      reference: buildRentalDpRef(orderNumber),
      memo: `Down payment for rental order ${orderNumber}${customerName ? ` - ${customerName}` : ''}`,
      sourceType: JournalSourceType.RENTAL_DEPOSIT,
      sourceId: orderId,
      date: businessDate,
      lines: [
        { accountCode: contraAccountCode, debit: dAmount.toNumber() },
        { accountCode: '2200', credit: dAmount.toNumber() },
      ],
    };

    return this.core.resolveAndCreate(companyId, data, tx);
  }

  /**
   * T005: Post Handover Serah Terima & Pelunasan 70% Journal
   * Debet: Kas / Bank (Asset) [Sisa 70%]
   * Debet: Uang Muka Sewa '2200' (Liability) [Kliring DP 30%]
   * Kredit: Pendapatan Sewa '4200' (Revenue) [Subtotal]
   * Kredit: Pendapatan Sewa/Ongkir '4200' (Revenue) [Delivery Fee]
   */
  async postRentalReleaseSettlement(
    params: PostRentalReleaseSettlementParams
  ): Promise<JournalEntry> {
    const {
      companyId,
      orderId,
      orderNumber,
      settlementAmount,
      downPaymentAmount,
      rentalRevenueAmount,
      deliveryFeeAmount,
      paymentAccountId,
      paymentMethod,
      customerName,
      tx,
      businessDate,
    } = params;

    const dSettlement = new Decimal(settlementAmount || 0);
    const dDownPayment = new Decimal(downPaymentAmount || 0);
    const dRevenue = new Decimal(rentalRevenueAmount || 0);
    const dDelivery = new Decimal(deliveryFeeAmount || 0);

    const totalDebit = dSettlement.plus(dDownPayment);
    const totalCredit = dRevenue.plus(dDelivery);

    if (totalDebit.lte(0) || totalCredit.lte(0)) {
      throw new DomainError(
        'Rental release settlement must have positive financial value',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    if (!totalDebit.equals(totalCredit)) {
      throw new DomainError(
        `Rental release settlement journal is unbalanced. Debits (${totalDebit.toString()}) !== Credits (${totalCredit.toString()})`,
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }

    const contraAccountCode =
      await this.accountResolver.resolveCashBankAccountCode(
        companyId,
        paymentAccountId,
        paymentMethod,
        tx
      );

    const lines: { accountCode: string; debit?: number; credit?: number }[] = [];

    if (dSettlement.gt(0)) {
      lines.push({ accountCode: contraAccountCode, debit: dSettlement.toNumber() });
    }
    if (dDownPayment.gt(0)) {
      lines.push({ accountCode: '2200', debit: dDownPayment.toNumber() });
    }
    if (dRevenue.gt(0)) {
      lines.push({ accountCode: '4200', credit: dRevenue.toNumber() });
    }
    if (dDelivery.gt(0)) {
      lines.push({ accountCode: '4200', credit: dDelivery.toNumber() });
    }

    const data = {
      reference: buildRentalReleaseRef(orderNumber),
      memo: `Rental handover release settlement for ${orderNumber}${customerName ? ` - ${customerName}` : ''}`,
      sourceType: JournalSourceType.PAYMENT,
      sourceId: orderId,
      date: businessDate,
      lines,
    };

    return this.core.resolveAndCreate(companyId, data, tx);
  }

  /**
   * T006: Post Rental Extension & Biaya Armada Ekstra Journal
   * Debet: Kas / Bank (Asset)
   * Kredit: Pendapatan Sewa '4200' (Revenue)
   * Kredit: Pendapatan Sewa / Biaya Armada '4200' (Revenue)
   */
  async postRentalExtension(
    params: PostRentalExtensionParams
  ): Promise<JournalEntry> {
    const {
      companyId,
      orderId,
      orderNumber,
      extensionAmount,
      extraDeliveryFee,
      paymentAccountId,
      paymentMethod,
      customerName,
      tx,
      businessDate,
    } = params;

    const dExt = new Decimal(extensionAmount || 0);
    const dFleet = new Decimal(extraDeliveryFee || 0);
    const totalCash = dExt.plus(dFleet);

    if (totalCash.lte(0)) {
      throw new DomainError(
        'Rental extension total amount must be greater than 0',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    const contraAccountCode =
      await this.accountResolver.resolveCashBankAccountCode(
        companyId,
        paymentAccountId,
        paymentMethod,
        tx
      );

    const lines: { accountCode: string; debit?: number; credit?: number }[] = [
      { accountCode: contraAccountCode, debit: totalCash.toNumber() },
    ];

    if (dExt.gt(0)) {
      lines.push({ accountCode: '4200', credit: dExt.toNumber() });
    }
    if (dFleet.gt(0)) {
      lines.push({ accountCode: '4200', credit: dFleet.toNumber() });
    }

    const data = {
      reference: params.reference ?? buildRentalExtensionRef(orderNumber),
      memo: `Rental extension payment for ${orderNumber}${customerName ? ` - ${customerName}` : ''}`,
      sourceType: JournalSourceType.PAYMENT,
      sourceId: params.sourceId ?? orderId,
      date: businessDate,
      lines,
    };

    return this.core.resolveAndCreate(companyId, data, tx);
  }

  /**
   * T007: Post Direct Return Damage / Cleaning Fee Journal
   * Debet: Kas / Bank (Asset)
   * Kredit: Pendapatan Denda '4200' (Revenue)
   */
  async postRentalDamageFee(
    params: PostRentalDamageFeeParams
  ): Promise<JournalEntry> {
    const {
      companyId,
      orderId,
      orderNumber,
      damageFeeAmount,
      paymentAccountId,
      paymentMethod,
      customerName,
      tx,
      businessDate,
    } = params;

    const dDamage = new Decimal(damageFeeAmount || 0);
    if (dDamage.lte(0)) {
      throw new DomainError(
        'Damage fee amount must be greater than 0',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    const contraAccountCode =
      await this.accountResolver.resolveCashBankAccountCode(
        companyId,
        paymentAccountId,
        paymentMethod,
        tx
      );

    const data = {
      reference: buildRentalDamageFeeRef(orderNumber),
      memo: `Rental damage/cleaning fee for ${orderNumber}${customerName ? ` - ${customerName}` : ''}`,
      sourceType: JournalSourceType.RENTAL_RETURN,
      sourceId: orderId,
      date: businessDate,
      lines: [
        { accountCode: contraAccountCode, debit: dDamage.toNumber() },
        { accountCode: '4200', credit: dDamage.toNumber() },
      ],
    };

    return this.core.resolveAndCreate(companyId, data, tx);
  }

  /**
   * Post Direct Rental Late Fee Journal
   * Debet: Kas / Bank (Asset)
   * Kredit: Pendapatan Denda '4200' (Revenue)
   */
  async postRentalLateFee(
    params: PostRentalLateFeeParams
  ): Promise<JournalEntry> {
    const {
      companyId,
      orderId,
      orderNumber,
      lateFeeAmount,
      paymentAccountId,
      paymentMethod,
      customerName,
      tx,
      businessDate,
    } = params;

    const dLate = new Decimal(lateFeeAmount || 0);
    if (dLate.lte(0)) {
      throw new DomainError(
        'Late fee amount must be greater than 0',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    const contraAccountCode =
      await this.accountResolver.resolveCashBankAccountCode(
        companyId,
        paymentAccountId,
        paymentMethod,
        tx
      );

    const data = {
      reference: buildRentalLateFeeRef(orderNumber),
      memo: `Rental late fee for ${orderNumber}${customerName ? ` - ${customerName}` : ''}`,
      sourceType: JournalSourceType.RENTAL_RETURN,
      sourceId: `${orderId}:late`,
      date: businessDate,
      lines: [
        { accountCode: contraAccountCode, debit: dLate.toNumber() },
        { accountCode: '4200', credit: dLate.toNumber() },
      ],
    };

    return this.core.resolveAndCreate(companyId, data, tx);
  }

  /**
   * T008: Post Rental Cancellation DP Refund Journal
   * Debet: Uang Muka Sewa '2200' (Liability)
   * Kredit: Kas / Bank (Asset)
   */
  async postRentalCancellationRefund(
    params: PostRentalCancellationRefundParams
  ): Promise<JournalEntry> {
    const {
      companyId,
      orderId,
      orderNumber,
      refundAmount,
      paymentAccountId,
      paymentMethod,
      customerName,
      tx,
      businessDate,
    } = params;

    const dRefund = new Decimal(refundAmount || 0);
    if (dRefund.lte(0)) {
      throw new DomainError(
        'Refund amount must be greater than 0',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }

    const contraAccountCode =
      await this.accountResolver.resolveCashBankAccountCode(
        companyId,
        paymentAccountId,
        paymentMethod,
        tx
      );

    const data = {
      reference: buildRentalRefundDpRef(orderNumber),
      memo: `Rental DP cancellation refund for ${orderNumber}${customerName ? ` - ${customerName}` : ''}`,
      sourceType: JournalSourceType.PAYMENT,
      sourceId: orderId,
      date: businessDate,
      lines: [
        { accountCode: '2200', debit: dRefund.toNumber() },
        { accountCode: contraAccountCode, credit: dRefund.toNumber() },
      ],
    };

    return this.core.resolveAndCreate(companyId, data, tx);
  }

  // ==========================================
  // LEGACY BACKWARD COMPATIBILITY METHODS
  // ==========================================

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
    return this.legacy.postRentalDeposit(
      companyId,
      depositId,
      orderNumber,
      amount,
      paymentMethod,
      tx,
      businessDate
    );
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
    return this.legacy.postRentalReturn(
      companyId,
      returnId,
      orderNumber,
      depositAmount,
      rentalRevenue,
      depositRefund,
      paymentMethod,
      tx,
      businessDate
    );
  }
}
