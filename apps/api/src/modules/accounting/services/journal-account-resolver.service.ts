import { PaymentMethodType, Prisma, getDb } from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

export class JournalAccountResolver {
  /**
   * Resolve cash/bank account code using explicit account ID, or falling back to payment method lookup.
   */
  async resolveCashBankAccountCode(
    companyId: string,
    paymentAccountId?: string,
    paymentMethod?: string,
    tx?: Prisma.TransactionClient
  ): Promise<string> {
    if (paymentAccountId) {
      const db = getDb(tx);
      const account = await db.account.findUnique({
        where: { id: paymentAccountId },
      });

      if (account && account.companyId === companyId) {
        return account.code;
      }

      // Check by code for tests/mock compatibility
      const accountByCode = await db.account.findUnique({
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

  /**
   * Resolve contra account code by checking CompanyPaymentMethod first, then fallback candidate codes.
   */
  async resolvePaymentContraAccountCode(
    companyId: string,
    method: string,
    tx?: Prisma.TransactionClient
  ): Promise<string> {
    const isBank =
      method === PaymentMethodType.BANK ||
      method === PaymentMethodType.QRIS ||
      method === PaymentMethodType.EWALLET ||
      method.toUpperCase().includes('BANK');

    const db = getDb(tx);

    // First try active CompanyPaymentMethod
    const defaultPm = await db.companyPaymentMethod.findFirst({
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
        `[JournalAccountResolver] Resolved payment contra account ${defaultPm.account.code} (${defaultPm.account.name}) via CompanyPaymentMethod`
      );
      return defaultPm.account.code;
    }

    const candidateCodes = isBank
      ? ['1211', '1201', '1200', '1100']
      : ['1000', '1101', '1100'];

    for (const code of candidateCodes) {
      const account = await db.account.findUnique({
        where: { companyId_code: { companyId, code } },
      });

      if (account && this.isValidPaymentContraAccount(method, account.name)) {
        console.warn(
          `[JournalAccountResolver] Fallback to candidate account ${account.code} (${account.name}) for ${method}`
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

  isValidPaymentContraAccount(method: string, accountName: string): boolean {
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
}
