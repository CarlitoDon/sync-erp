import { describe, expect, it, beforeEach, vi } from 'vitest';
import { PaymentMethodType, Prisma } from '@sync-erp/database';
import { DomainError } from '@sync-erp/shared';
import { JournalRentalService } from '../../../src/modules/accounting/services/journal-rental.service';
import { JournalService } from '../../../src/modules/accounting/services/journal.service';
import { JournalCoreService } from '../../../src/modules/accounting/services/journal-core.service';
import { JournalRepository } from '../../../src/modules/accounting/repositories/journal.repository';
import { AccountService } from '../../../src/modules/accounting/services/account.service';
import { mockPrisma, resetMocks } from '../mocks/prisma.mock';

// eslint-disable-next-line @sync-erp/no-hardcoded-enum
const JournalSourceType = {
  RENTAL_DEPOSIT: 'RENTAL_DEPOSIT',
  PAYMENT: 'PAYMENT',
  RENTAL_RETURN: 'RENTAL_RETURN',
} as const;

describe('JournalRentalService (Double-Entry Accounting Automation)', () => {
  let rentalService: JournalRentalService;
  let facadeService: JournalService;
  let coreService: JournalCoreService;
  const COMPANY_ID = 'company-test-uuid';

  const mockAccounts = [
    { id: 'acc-cash-id', code: '1100', name: 'Cash on Hand', companyId: COMPANY_ID, type: 'ASSET' },
    { id: 'acc-cash-main-id', code: '1101', name: 'Kas on Hand (Main)', companyId: COMPANY_ID, type: 'ASSET' },
    { id: 'acc-bank-id', code: '1200', name: 'Bank BCA', companyId: COMPANY_ID, type: 'ASSET' },
    { id: 'acc-bank-corp-id', code: '1201', name: 'BCA Corporate', companyId: COMPANY_ID, type: 'ASSET' },
    { id: 'acc-dp-id', code: '2200', name: 'Customer Deposits', companyId: COMPANY_ID, type: 'LIABILITY' },
    { id: 'acc-legacy-deposit-id', code: '2400', name: 'Rental Deposits', companyId: COMPANY_ID, type: 'LIABILITY' },
    { id: 'acc-rev-id', code: '4200', name: 'Service & Rental Income', companyId: COMPANY_ID, type: 'REVENUE' },
  ];

  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();

    mockPrisma.account.findUnique.mockImplementation(
      ({ where }: { where: { id?: string; companyId_code?: { companyId: string; code: string } } }) => {
        if (where.id) {
          const acc = mockAccounts.find((a) => a.id === where.id);
          return Promise.resolve(acc || null);
        }
        if (where.companyId_code) {
          const acc = mockAccounts.find(
            (a) => a.companyId === where.companyId_code?.companyId && a.code === where.companyId_code.code
          );
          return Promise.resolve(acc || null);
        }
        return Promise.resolve(null);
      }
    );

    mockPrisma.account.findFirst.mockImplementation(
      ({ where }: { where: { id?: string; code?: string; companyId?: string } }) => {
        if (where.id) {
          const acc = mockAccounts.find(
            (a) => (!where.companyId || a.companyId === where.companyId) && a.id === where.id
          );
          return Promise.resolve(acc || null);
        }
        if (where.code) {
          const acc = mockAccounts.find(
            (a) => (!where.companyId || a.companyId === where.companyId) && a.code === where.code
          );
          return Promise.resolve(acc || null);
        }
        return Promise.resolve(null);
      }
    );

    mockPrisma.journalEntry.create.mockImplementation(({ data }: { data: unknown }) => {
      const record = data as {
        companyId: string;
        reference: string;
        memo: string;
        lines: { create: Array<{ accountId: string; debit: number; credit: number }> };
      };
      return Promise.resolve({
        id: 'journal-uuid-1',
        ...record,
        lines: record.lines.create.map((l, idx) => ({ id: `line-${idx}`, ...l })),
      });
    });

    const repo = new JournalRepository();
    const accountSvc = new AccountService();
    coreService = new JournalCoreService(repo, accountSvc);
    rentalService = new JournalRentalService(coreService);
    facadeService = new JournalService(repo, accountSvc);
  });

  describe('T004: postRentalDownPayment', () => {
    it('should create balanced dual-entry journal: Dr Kas/Bank, Cr Uang Muka Sewa (2200)', async () => {
      await rentalService.postRentalDownPayment({
        companyId: COMPANY_ID,
        orderId: 'order-1',
        orderNumber: 'ORD-001',
        downPaymentAmount: 300000,
        paymentMethod: PaymentMethodType.BANK,
        customerName: 'Budi Santoso',
      });

      expect(mockPrisma.journalEntry.create).toHaveBeenCalledTimes(1);
      const callArgs = mockPrisma.journalEntry.create.mock.calls[0][0];
      expect(callArgs.data.reference).toBe('Rental DP: ORD-001');
      expect(callArgs.data.memo).toBe('Down payment for rental order ORD-001 - Budi Santoso');
      expect(callArgs.data.sourceType).toBe(JournalSourceType.RENTAL_DEPOSIT);
      expect(callArgs.data.sourceId).toBe('order-1');

      const lines = callArgs.data.lines.create;
      expect(lines).toHaveLength(2);

      const debitLine = lines.find((l: { debit: number }) => l.debit > 0);
      const creditLine = lines.find((l: { credit: number }) => l.credit > 0);

      expect(debitLine.accountId).toBe('acc-bank-corp-id'); // Resolved candidate 1201
      expect(debitLine.debit).toBe(300000);
      expect(creditLine.accountId).toBe('acc-dp-id'); // Uang Muka 2200
      expect(creditLine.credit).toBe(300000);
    });

    it('should resolve payment account by explicit paymentAccountId UUID', async () => {
      await rentalService.postRentalDownPayment({
        companyId: COMPANY_ID,
        orderId: 'order-1',
        orderNumber: 'ORD-001',
        downPaymentAmount: 150000,
        paymentAccountId: 'acc-cash-id',
      });

      const callArgs = mockPrisma.journalEntry.create.mock.calls[0][0];
      const debitLine = callArgs.data.lines.create.find((l: { debit: number }) => l.debit > 0);
      expect(debitLine.accountId).toBe('acc-cash-id');
    });

    it('should resolve payment account by explicit paymentAccountId code', async () => {
      await rentalService.postRentalDownPayment({
        companyId: COMPANY_ID,
        orderId: 'order-1',
        orderNumber: 'ORD-001',
        downPaymentAmount: 150000,
        paymentAccountId: '1200',
      });

      const callArgs = mockPrisma.journalEntry.create.mock.calls[0][0];
      const debitLine = callArgs.data.lines.create.find((l: { debit: number }) => l.debit > 0);
      expect(debitLine.accountId).toBe('acc-bank-id');
    });

    it('should resolve Indonesian kas account candidate for CASH method', async () => {
      await rentalService.postRentalDownPayment({
        companyId: COMPANY_ID,
        orderId: 'order-1',
        orderNumber: 'ORD-001',
        downPaymentAmount: 200000,
        paymentMethod: PaymentMethodType.CASH,
      });

      const callArgs = mockPrisma.journalEntry.create.mock.calls[0][0];
      const debitLine = callArgs.data.lines.create.find((l: { debit: number }) => l.debit > 0);
      expect(debitLine.accountId).toBe('acc-cash-main-id'); // candidate 1101 matched 'Kas on Hand (Main)'
    });

    it('should reject non-positive down payment amount (0)', async () => {
      await expect(
        rentalService.postRentalDownPayment({
          companyId: COMPANY_ID,
          orderId: 'order-1',
          orderNumber: 'ORD-001',
          downPaymentAmount: 0,
        })
      ).rejects.toThrow(DomainError);
    });

    it('should reject negative down payment amount', async () => {
      await expect(
        rentalService.postRentalDownPayment({
          companyId: COMPANY_ID,
          orderId: 'order-1',
          orderNumber: 'ORD-001',
          downPaymentAmount: -50000,
        })
      ).rejects.toThrow(DomainError);
    });
  });

  describe('T005: postRentalReleaseSettlement', () => {
    it('should create balanced dual-entry journal: Dr Kas (70%), Dr DP (2200), Cr Revenue (4200), Cr Ongkir (4200)', async () => {
      await rentalService.postRentalReleaseSettlement({
        companyId: COMPANY_ID,
        orderId: 'order-1',
        orderNumber: 'ORD-001',
        settlementAmount: 700000, // 70% sisa
        downPaymentAmount: 300000, // 30% kliring
        rentalRevenueAmount: 900000, // Subtotal sewa
        deliveryFeeAmount: 100000, // Ongkir
        paymentMethod: PaymentMethodType.CASH,
        customerName: 'Budi Santoso',
      });

      expect(mockPrisma.journalEntry.create).toHaveBeenCalledTimes(1);
      const callArgs = mockPrisma.journalEntry.create.mock.calls[0][0];
      expect(callArgs.data.reference).toBe('Rental Release: ORD-001');
      expect(callArgs.data.sourceType).toBe(JournalSourceType.PAYMENT);
      expect(callArgs.data.sourceId).toBe('order-1');

      const lines = callArgs.data.lines.create;
      const totalDebit = lines.reduce((sum: number, l: { debit?: number }) => sum + (l.debit || 0), 0);
      const totalCredit = lines.reduce((sum: number, l: { credit?: number }) => sum + (l.credit || 0), 0);

      expect(totalDebit).toBe(1000000);
      expect(totalCredit).toBe(1000000);
      expect(totalDebit).toBe(totalCredit);

      const dpLine = lines.find((l: { accountId: string; debit?: number }) => l.accountId === 'acc-dp-id');
      expect(dpLine?.debit).toBe(300000);

      const revLines = lines.filter((l: { accountId: string; credit?: number }) => l.accountId === 'acc-rev-id');
      const totalRevCredit = revLines.reduce((sum: number, l: { credit?: number }) => sum + (l.credit || 0), 0);
      expect(totalRevCredit).toBe(1000000);
    });

    it('should throw DomainError when debits do not match credits', async () => {
      await expect(
        rentalService.postRentalReleaseSettlement({
          companyId: COMPANY_ID,
          orderId: 'order-1',
          orderNumber: 'ORD-001',
          settlementAmount: 500000, // Debits = 500k + 300k = 800k
          downPaymentAmount: 300000,
          rentalRevenueAmount: 900000, // Credits = 900k + 100k = 1M (unbalanced!)
          deliveryFeeAmount: 100000,
        })
      ).rejects.toThrow('Rental release settlement journal is unbalanced');
    });

    it('should omit 0-value lines (e.g. 100% prepaid order with 0 delivery fee)', async () => {
      await rentalService.postRentalReleaseSettlement({
        companyId: COMPANY_ID,
        orderId: 'order-1',
        orderNumber: 'ORD-001',
        settlementAmount: 0,
        downPaymentAmount: 500000,
        rentalRevenueAmount: 500000,
        deliveryFeeAmount: 0,
      });

      const callArgs = mockPrisma.journalEntry.create.mock.calls[0][0];
      const lines = callArgs.data.lines.create;
      expect(lines).toHaveLength(2); // Dr DP 2200, Cr Revenue 4200
      expect(lines.every((l: { debit?: number; credit?: number }) => (l.debit || 0) > 0 || (l.credit || 0) > 0)).toBe(true);
    });

    it('should reject when total debit or credit is non-positive', async () => {
      await expect(
        rentalService.postRentalReleaseSettlement({
          companyId: COMPANY_ID,
          orderId: 'order-1',
          orderNumber: 'ORD-001',
          settlementAmount: 0,
          downPaymentAmount: 0,
          rentalRevenueAmount: 0,
          deliveryFeeAmount: 0,
        })
      ).rejects.toThrow('Rental release settlement must have positive financial value');
    });
  });

  describe('T006: postRentalExtension', () => {
    it('should create balanced dual-entry: Dr Kas/Bank, Cr Revenue (4200) & Extra Fleet Fee (4200)', async () => {
      await rentalService.postRentalExtension({
        companyId: COMPANY_ID,
        orderId: 'order-1',
        orderNumber: 'ORD-001',
        extensionAmount: 200000,
        extraDeliveryFee: 50000,
        paymentMethod: PaymentMethodType.BANK,
        customerName: 'Budi Santoso',
      });

      const callArgs = mockPrisma.journalEntry.create.mock.calls[0][0];
      expect(callArgs.data.reference).toBe('Rental Extension: ORD-001');
      expect(callArgs.data.memo).toBe('Rental extension payment for ORD-001 - Budi Santoso');
      expect(callArgs.data.sourceType).toBe(JournalSourceType.PAYMENT);
      expect(callArgs.data.sourceId).toBe('order-1');

      const lines = callArgs.data.lines.create;
      const totalDebit = lines.reduce((sum: number, l: { debit?: number }) => sum + (l.debit || 0), 0);
      const totalCredit = lines.reduce((sum: number, l: { credit?: number }) => sum + (l.credit || 0), 0);

      expect(totalDebit).toBe(250000);
      expect(totalCredit).toBe(250000);
      expect(lines).toHaveLength(3); // Cash debit, Ext revenue credit, Fleet fee credit
    });

    it('should omit extraDeliveryFee line when 0', async () => {
      await rentalService.postRentalExtension({
        companyId: COMPANY_ID,
        orderId: 'order-1',
        orderNumber: 'ORD-001',
        extensionAmount: 150000,
        extraDeliveryFee: 0,
        paymentMethod: PaymentMethodType.BANK,
      });

      const callArgs = mockPrisma.journalEntry.create.mock.calls[0][0];
      const lines = callArgs.data.lines.create;
      expect(lines).toHaveLength(2); // Cash debit, Ext revenue credit
      expect(lines[0].debit).toBe(150000);
      expect(lines[1].credit).toBe(150000);
    });

    it('should reject non-positive total amount for extension', async () => {
      await expect(
        rentalService.postRentalExtension({
          companyId: COMPANY_ID,
          orderId: 'order-1',
          orderNumber: 'ORD-001',
          extensionAmount: 0,
          extraDeliveryFee: 0,
        })
      ).rejects.toThrow(DomainError);
    });
  });

  describe('T007: postRentalDamageFee', () => {
    it('should create balanced dual-entry: Dr Kas/Bank, Cr Pendapatan Denda (4200)', async () => {
      await rentalService.postRentalDamageFee({
        companyId: COMPANY_ID,
        orderId: 'order-1',
        orderNumber: 'ORD-001',
        damageFeeAmount: 75000,
        paymentMethod: PaymentMethodType.CASH,
        customerName: 'Budi Santoso',
      });

      const callArgs = mockPrisma.journalEntry.create.mock.calls[0][0];
      expect(callArgs.data.reference).toBe('Rental Damage Fee: ORD-001');
      expect(callArgs.data.memo).toBe('Rental damage/cleaning fee for ORD-001 - Budi Santoso');
      expect(callArgs.data.sourceType).toBe(JournalSourceType.RENTAL_RETURN);
      expect(callArgs.data.sourceId).toBe('order-1');

      const lines = callArgs.data.lines.create;
      expect(lines).toHaveLength(2);
      expect(lines[0].debit).toBe(75000);
      expect(lines[0].accountId).toBe('acc-cash-main-id');
      expect(lines[1].credit).toBe(75000);
      expect(lines[1].accountId).toBe('acc-rev-id');
    });

    it('should reject non-positive damage fee amount', async () => {
      await expect(
        rentalService.postRentalDamageFee({
          companyId: COMPANY_ID,
          orderId: 'order-1',
          orderNumber: 'ORD-001',
          damageFeeAmount: 0,
        })
      ).rejects.toThrow(DomainError);
    });
  });

  describe('T008: postRentalCancellationRefund', () => {
    it('should create balanced dual-entry: Dr Uang Muka Sewa (2200), Cr Kas/Bank', async () => {
      await rentalService.postRentalCancellationRefund({
        companyId: COMPANY_ID,
        orderId: 'order-1',
        orderNumber: 'ORD-001',
        refundAmount: 300000,
        paymentMethod: PaymentMethodType.BANK,
        customerName: 'Budi Santoso',
      });

      const callArgs = mockPrisma.journalEntry.create.mock.calls[0][0];
      expect(callArgs.data.reference).toBe('Rental Refund DP: ORD-001');
      expect(callArgs.data.memo).toBe('Rental DP cancellation refund for ORD-001 - Budi Santoso');
      expect(callArgs.data.sourceType).toBe(JournalSourceType.PAYMENT);
      expect(callArgs.data.sourceId).toBe('order-1');

      const lines = callArgs.data.lines.create;
      expect(lines).toHaveLength(2);
      expect(lines[0].accountId).toBe('acc-dp-id'); // Dr 2200
      expect(lines[0].debit).toBe(300000);
      expect(lines[1].accountId).toBe('acc-bank-corp-id'); // Cr 1201
      expect(lines[1].credit).toBe(300000);
    });

    it('should reject non-positive refund amount', async () => {
      await expect(
        rentalService.postRentalCancellationRefund({
          companyId: COMPANY_ID,
          orderId: 'order-1',
          orderNumber: 'ORD-001',
          refundAmount: -100,
        })
      ).rejects.toThrow(DomainError);
    });
  });

  describe('T009: JournalService Facade Delegation', () => {
    it('should correctly delegate all 5 rental methods from facade to rental service', async () => {
      const spyDP = vi.spyOn(facadeService.rental, 'postRentalDownPayment');
      const spyRel = vi.spyOn(facadeService.rental, 'postRentalReleaseSettlement');
      const spyExt = vi.spyOn(facadeService.rental, 'postRentalExtension');
      const spyDmg = vi.spyOn(facadeService.rental, 'postRentalDamageFee');
      const spyRef = vi.spyOn(facadeService.rental, 'postRentalCancellationRefund');

      await facadeService.postRentalDownPayment({
        companyId: COMPANY_ID,
        orderId: 'order-1',
        orderNumber: 'ORD-001',
        downPaymentAmount: 100000,
      });
      expect(spyDP).toHaveBeenCalledTimes(1);

      await facadeService.postRentalReleaseSettlement({
        companyId: COMPANY_ID,
        orderId: 'order-1',
        orderNumber: 'ORD-001',
        settlementAmount: 200000,
        downPaymentAmount: 100000,
        rentalRevenueAmount: 300000,
      });
      expect(spyRel).toHaveBeenCalledTimes(1);

      await facadeService.postRentalExtension({
        companyId: COMPANY_ID,
        orderId: 'order-1',
        orderNumber: 'ORD-001',
        extensionAmount: 50000,
      });
      expect(spyExt).toHaveBeenCalledTimes(1);

      await facadeService.postRentalDamageFee({
        companyId: COMPANY_ID,
        orderId: 'order-1',
        orderNumber: 'ORD-001',
        damageFeeAmount: 25000,
      });
      expect(spyDmg).toHaveBeenCalledTimes(1);

      await facadeService.postRentalCancellationRefund({
        companyId: COMPANY_ID,
        orderId: 'order-1',
        orderNumber: 'ORD-001',
        refundAmount: 100000,
      });
      expect(spyRef).toHaveBeenCalledTimes(1);
    });

    it('should correctly delegate legacy methods', async () => {
      const spyLegacyDep = vi.spyOn(facadeService.rental, 'postRentalDeposit');
      const spyLegacyRet = vi.spyOn(facadeService.rental, 'postRentalReturn');

      // Legacy deposit
      await facadeService.postRentalDeposit(
        COMPANY_ID,
        'dep-1',
        'ORD-001',
        100000,
        PaymentMethodType.BANK
      );
      expect(spyLegacyDep).toHaveBeenCalledTimes(1);

      // Legacy return
      await facadeService.postRentalReturn(
        COMPANY_ID,
        'ret-1',
        'ORD-001',
        100000,
        150000,
        0,
        PaymentMethodType.BANK
      );
      expect(spyLegacyRet).toHaveBeenCalledTimes(1);
    });
  });

  describe('Transaction Client Support', () => {
    it('should propagate tx client across operations', async () => {
      const mockTx = {
        account: {
          findUnique: vi.fn().mockImplementation(({ where }: { where: { id?: string; companyId_code?: { companyId: string; code: string } } }) => {
            if (where.id) {
              return Promise.resolve(mockAccounts.find((a) => a.id === where.id) || null);
            }
            if (where.companyId_code) {
              return Promise.resolve(
                mockAccounts.find(
                  (a) => a.companyId === where.companyId_code?.companyId && a.code === where.companyId_code.code
                ) || null
              );
            }
            return Promise.resolve(null);
          }),
        },
        journalEntry: {
          create: vi.fn().mockImplementation(({ data }: { data: unknown }) => {
            const record = data as {
              companyId: string;
              reference: string;
              memo: string;
              lines: { create: Array<{ accountId: string; debit: number; credit: number }> };
            };
            return Promise.resolve({
              id: 'journal-uuid-tx',
              ...record,
              lines: record.lines.create.map((l, idx) => ({ id: `line-${idx}`, ...l })),
            });
          }),
        },
      } as unknown as Prisma.TransactionClient;

      await rentalService.postRentalDownPayment({
        companyId: COMPANY_ID,
        orderId: 'order-1',
        orderNumber: 'ORD-001',
        downPaymentAmount: 250000,
        paymentAccountId: 'acc-cash-id',
        tx: mockTx,
      });

      expect(mockTx.account.findUnique).toHaveBeenCalled();
    });
  });
});
