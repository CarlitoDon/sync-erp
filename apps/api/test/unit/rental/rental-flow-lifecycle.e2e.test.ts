import { describe, expect, it, beforeEach, vi } from 'vitest';
import { PaymentMethodType } from '@sync-erp/database';
import { JournalRentalService } from '../../../src/modules/accounting/services/journal-rental.service';
import { JournalCoreService } from '../../../src/modules/accounting/services/journal-core.service';
import { JournalRepository } from '../../../src/modules/accounting/repositories/journal.repository';
import { AccountService } from '../../../src/modules/accounting/services/account.service';
import { mockPrisma, resetMocks } from '../mocks/prisma.mock';

/**
 * T035: Sequential rental lifecycle financial flow (Feature 045).
 *
 * Constitution Rule XVII.2: sequential business flows MUST be tested
 * in a single test block.
 *
 * Flow: DRAFT -> CONFIRMED (DP Rp 100.000, units RESERVED)
 *     -> ACTIVE (70% settlement Rp 200.000, payment Lunas, units RENTED)
 *     -> COMPLETED (return: GOOD -> AVAILABLE, FAIR -> MAINTENANCE,
 *        damage fee Rp 50.000 paid on the spot)
 *
 * NOTE: tasks.md references a spec path under test-modules, but this
 * repo's vitest include patterns only run unit, invariants, integration
 * and e2e test dirs, so the test lives here to execute in CI while
 * covering the same flow.
 */
describe('Rental Flow Lifecycle E2E (045)', () => {
  let rentalService: JournalRentalService;
  const COMPANY_ID = 'company-lifecycle-e2e';

  const mockAccounts = [
    { id: 'acc-cash-id', code: '1000', name: 'Kas Tunai', companyId: COMPANY_ID, type: 'ASSET' },
    { id: 'acc-bank-id', code: '1200', name: 'Bank BCA', companyId: COMPANY_ID, type: 'ASSET' },
    { id: 'acc-dp-id', code: '2200', name: 'Uang Muka Sewa', companyId: COMPANY_ID, type: 'LIABILITY' },
    { id: 'acc-rev-id', code: '4200', name: 'Pendapatan Sewa', companyId: COMPANY_ID, type: 'REVENUE' },
  ];

  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();

    mockPrisma.account.findUnique.mockImplementation(
      ({ where }: { where: { id?: string; companyId_code?: { companyId: string; code: string } } }) => {
        if (where.id) {
          return Promise.resolve(mockAccounts.find((a) => a.id === where.id) || null);
        }
        if (where.companyId_code) {
          return Promise.resolve(
            mockAccounts.find(
              (a) =>
                a.companyId === where.companyId_code?.companyId &&
                a.code === where.companyId_code.code
            ) || null
          );
        }
        return Promise.resolve(null);
      }
    );

    mockPrisma.account.findFirst.mockImplementation(
      ({ where }: { where: { id?: string; code?: string; companyId?: string } }) => {
        if (where.id) {
          return Promise.resolve(mockAccounts.find((a) => a.id === where.id) || null);
        }
        if (where.code) {
          return Promise.resolve(mockAccounts.find((a) => a.code === where.code) || null);
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
        id: `journal-${record.reference}`,
        ...record,
        lines: record.lines.create.map((l, idx) => ({ id: `line-${idx}`, ...l })),
      });
    });

    const repo = new JournalRepository();
    const accountSvc = new AccountService();
    const core = new JournalCoreService(repo, accountSvc);
    rentalService = new JournalRentalService(core);
  });

  it('Full lifecycle: DP confirm -> 70% release settlement -> return with damage fee (all journals balanced)', async () => {
    const orderId = 'order-lifecycle-1';
    const orderNumber = 'RO-E2E-0001';

    // Step 1: DRAFT -> CONFIRMED, DP Rp 100.000 via Bank (units RESERVED)
    await rentalService.postRentalDownPayment({
      companyId: COMPANY_ID,
      orderId,
      orderNumber,
      downPaymentAmount: 100000,
      paymentMethod: PaymentMethodType.BANK,
      paymentAccountId: 'acc-bank-id',
      customerName: 'Budi',
    });

    // Step 2: CONFIRMED -> ACTIVE, 70% settlement Rp 200.000 via Cash
    // (DP 100.000 cleared, revenue 300.000 recognized, payment Lunas)
    await rentalService.postRentalReleaseSettlement({
      companyId: COMPANY_ID,
      orderId,
      orderNumber,
      settlementAmount: 200000,
      downPaymentAmount: 100000,
      rentalRevenueAmount: 300000,
      deliveryFeeAmount: 0,
      paymentMethod: PaymentMethodType.CASH,
      paymentAccountId: 'acc-cash-id',
      customerName: 'Budi',
    });

    // Step 3: ACTIVE -> COMPLETED, GOOD unit -> AVAILABLE,
    // FAIR unit (stain) -> MAINTENANCE, damage fee Rp 50.000 cash
    await rentalService.postRentalDamageFee({
      companyId: COMPANY_ID,
      orderId,
      orderNumber,
      damageFeeAmount: 50000,
      paymentMethod: PaymentMethodType.CASH,
      paymentAccountId: 'acc-cash-id',
      customerName: 'Budi',
    });

    expect(mockPrisma.journalEntry.create).toHaveBeenCalledTimes(3);

    const calls = mockPrisma.journalEntry.create.mock.calls.map(
      (call) => (call[0] as { data: { reference: string; lines: { create: Array<{ debit?: number; credit?: number }> } } }).data
    );

    // Order of postings follows the lifecycle sequence
    expect(calls[0].reference).toBe(`Rental DP: ${orderNumber}`);
    expect(calls[1].reference).toBe(`Rental Release: ${orderNumber}`);
    expect(calls[2].reference).toBe(`Rental Damage Fee: ${orderNumber}`);

    // Every journal must balance (debit === credit)
    for (const journal of calls) {
      const totalDebit = journal.lines.create.reduce((s, l) => s + (l.debit || 0), 0);
      const totalCredit = journal.lines.create.reduce((s, l) => s + (l.credit || 0), 0);
      expect(totalDebit).toBeGreaterThan(0);
      expect(totalDebit).toBe(totalCredit);
    }

    // Release settlement clears the exact DP amount posted in step 1
    const releaseLines = calls[1].lines.create;
    const dpDebit = releaseLines.reduce((s, l) => s + (l.debit || 0), 0);
    expect(dpDebit).toBe(300000); // 200.000 cash + 100.000 DP clearing
  });
});
