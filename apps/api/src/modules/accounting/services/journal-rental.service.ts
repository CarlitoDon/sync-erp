import type {
  JournalEntry,
} from '@sync-erp/database';
import {
  PaymentMethodType,
  Prisma,
  prisma,
} from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';
import { Decimal } from 'decimal.js';
import { JournalCoreService } from './journal-core.service';

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
  constructor(private readonly core: JournalCoreService) {}

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

    const contraAccountCode = await this.resolveCashBankAccountCode(
      companyId,
      paymentAccountId,
      paymentMethod,
      tx
    );

    const data = {
      reference: `Rental DP: ${orderNumber}`,
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

    const contraAccountCode = await this.resolveCashBankAccountCode(
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
      reference: `Rental Release: ${orderNumber}`,
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

    const contraAccountCode = await this.resolveCashBankAccountCode(
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
      reference: params.reference ?? `Rental Extension: ${orderNumber}`,
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

    const contraAccountCode = await this.resolveCashBankAccountCode(
      companyId,
      paymentAccountId,
      paymentMethod,
      tx
    );

    const data = {
      reference: `Rental Damage Fee: ${orderNumber}`,
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

    const contraAccountCode = await this.resolveCashBankAccountCode(
      companyId,
      paymentAccountId,
      paymentMethod,
      tx
    );

    const data = {
      reference: `Rental Late Fee: ${orderNumber}`,
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

    const contraAccountCode = await this.resolveCashBankAccountCode(
      companyId,
      paymentAccountId,
      paymentMethod,
      tx
    );

    const data = {
      reference: `Rental Refund DP: ${orderNumber}`,
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

  async postRentalDeposit(
    companyId: string,
    depositId: string,
    orderNumber: string,
    amount: number,
    paymentMethod: string,
    tx?: Prisma.TransactionClient,
    businessDate?: Date
  ) {
    const contraAccountCode =
      await this.resolvePaymentContraAccountCode(
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
  ) {
    const contraAccountCode =
      await this.resolvePaymentContraAccountCode(
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

  // --- Helpers (Private) ---

  private prepareRentalDepositJournal(
    depositId: string,
    orderNumber: string,
    amount: number,
    paymentMethod: string,
    contraAccountCode: string,
    businessDate?: Date
  ) {
    return {
      reference: `Rental Deposit: ${orderNumber}`,
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
      // This means customer pays extra
      lines.push({
        accountCode: contraAccountCode,
        debit: additionalCharge,
      });
    }

    return {
      reference: `Rental Return: ${orderNumber}`,
      memo: `Rental return settlement via ${paymentMethod} - Revenue: ${rentalRevenue}, Refund: ${depositRefund}`,
      sourceType: JournalSourceType.RENTAL_RETURN,
      sourceId: returnId,
      date: businessDate,
      lines,
    };
  }

  private async resolveCashBankAccountCode(
    companyId: string,
    paymentAccountId?: string,
    paymentMethod?: string,
    tx?: Prisma.TransactionClient
  ): Promise<string> {
    if (paymentAccountId) {
      const account = tx
        ? await tx.account.findUnique({ where: { id: paymentAccountId } })
        : await prisma.account.findUnique({ where: { id: paymentAccountId } });

      if (account && account.companyId === companyId) {
        return account.code;
      }

      // Check by code for tests/mock compatibility
      const accountByCode = tx
        ? await tx.account.findUnique({
            where: { companyId_code: { companyId, code: paymentAccountId } },
          })
        : await prisma.account.findUnique({
            where: { companyId_code: { companyId, code: paymentAccountId } },
          });

      if (accountByCode) {
        return accountByCode.code;
      }
    }

    return this.resolvePaymentContraAccountCode(
      companyId,
      paymentMethod || PaymentMethodType.CASH,
      tx
    );
  }

  private async resolvePaymentContraAccountCode(
    companyId: string,
    method: string,
    tx?: Prisma.TransactionClient
  ): Promise<string> {
    const isBank =
      method === PaymentMethodType.BANK ||
      method === PaymentMethodType.QRIS ||
      method === PaymentMethodType.EWALLET ||
      method.toUpperCase().includes('BANK');

    // First try active CompanyPaymentMethod
    const defaultPm = tx
      ? await tx.companyPaymentMethod.findFirst({
          where: {
            companyId,
            isActive: true,
            type: isBank ? PaymentMethodType.BANK : PaymentMethodType.CASH,
          },
          include: { account: true },
          orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
        })
      : await prisma.companyPaymentMethod.findFirst({
          where: {
            companyId,
            isActive: true,
            type: isBank ? PaymentMethodType.BANK : PaymentMethodType.CASH,
          },
          include: { account: true },
          orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
        });

    if (defaultPm?.account?.code) {
      console.warn(
        `[JournalRental] Resolved payment contra account ${defaultPm.account.code} (${defaultPm.account.name}) via CompanyPaymentMethod`
      );
      return defaultPm.account.code;
    }

    const candidateCodes = isBank
      ? ['1211', '1201', '1200', '1100']
      : ['1000', '1101', '1100'];

    for (const code of candidateCodes) {
      const account = tx
        ? await tx.account.findUnique({
            where: { companyId_code: { companyId, code } },
          })
        : await prisma.account.findUnique({
            where: { companyId_code: { companyId, code } },
          });

      if (account && isValidPaymentContraAccount(method, account.name)) {
        console.warn(
          `[JournalRental] Fallback to candidate account ${account.code} (${account.name}) for ${method}`
        );
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
    return (
      normalized.includes('bank') ||
      normalized.includes('bca') ||
      normalized.includes('mandiri') ||
      normalized.includes('bri') ||
      normalized.includes('bni')
    );
  }

  return normalized.includes('cash') || normalized.includes('kas');
}
