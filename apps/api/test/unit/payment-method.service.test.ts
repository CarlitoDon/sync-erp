import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentMethodType } from '@sync-erp/database';
import * as paymentMethodService from '../../src/modules/common/payment-method.service';

const repoMocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findById: vi.fn(),
  findByCode: vi.fn(),
  findByCodeExcluding: vi.fn(),
  count: vi.fn(),
  findAccountByCode: vi.fn(),
  findAccountById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  unsetDefaultsByType: vi.fn(),
  createMany: vi.fn(),
}));

vi.mock('../../src/modules/common/payment-method.repository', () => repoMocks);

describe('payment-method.service', () => {
  const companyId = 'company-1';

  beforeEach(() => {
    Object.values(repoMocks).forEach((mock) => mock.mockReset());
  });

  describe('seedDefaults', () => {
    it('uses cash, Bank Jago, and owner contribution accounts when available', async () => {
      repoMocks.count.mockResolvedValue(0);
      repoMocks.findAccountByCode.mockImplementation(
        async (code: string) =>
          ({
            '1000': { id: 'cash-account', code: '1000', name: 'Cash' },
            '1211': {
              id: 'bank-jago-account',
              code: '1211',
              name: 'Bank Jago',
            },
            '3210': {
              id: 'owner-contribution-account',
              code: '3210',
              name: 'Modal Pemilik',
            },
          })[code] ?? null
      );
      repoMocks.createMany.mockResolvedValue({ count: 4 });

      await paymentMethodService.seedDefaults({ companyId });

      expect(repoMocks.createMany).toHaveBeenCalledWith([
        expect.objectContaining({
          code: PaymentMethodType.CASH,
          accountId: 'cash-account',
        }),
        expect.objectContaining({
          code: PaymentMethodType.BANK,
          accountId: 'bank-jago-account',
        }),
        expect.objectContaining({
          code: 'QRIS',
          accountId: 'bank-jago-account',
        }),
        expect.objectContaining({
          code: 'OWNER_CONTRIBUTION',
          name: 'Setoran Modal Pemilik',
          type: PaymentMethodType.OTHER,
          accountId: 'owner-contribution-account',
        }),
      ]);
    });

    it('does not fall back to Inventory or Receivable accounts', async () => {
      repoMocks.count.mockResolvedValue(0);
      repoMocks.findAccountByCode.mockImplementation(
        async (code: string) =>
          ({
            '1100': {
              id: 'receivable-account',
              code: '1100',
              name: 'Accounts Receivable',
            },
            '1200': {
              id: 'inventory-account',
              code: '1200',
              name: 'Inventory',
            },
          })[code] ?? null
      );
      repoMocks.createMany.mockResolvedValue({ count: 3 });

      await paymentMethodService.seedDefaults({ companyId });

      const seededMethods = repoMocks.createMany.mock.calls[0][0];
      expect(seededMethods).toEqual([
        expect.objectContaining({
          code: PaymentMethodType.CASH,
          accountId: undefined,
        }),
        expect.objectContaining({
          code: PaymentMethodType.BANK,
          accountId: undefined,
        }),
        expect.objectContaining({
          code: 'QRIS',
          accountId: undefined,
        }),
      ]);
    });
  });

  describe('create', () => {
    it('rejects bank-like methods linked to Inventory', async () => {
      repoMocks.findByCode.mockResolvedValue(null);
      repoMocks.findAccountById.mockResolvedValue({
        id: 'inventory-account',
        code: '1200',
        name: 'Inventory',
      });

      await expect(
        paymentMethodService.create({
          companyId,
          code: 'BAD_BANK',
          name: 'Bad Bank',
          type: PaymentMethodType.BANK,
          accountId: 'inventory-account',
        })
      ).rejects.toThrow(
        'BANK payment method cannot use account 1200 Inventory'
      );

      expect(repoMocks.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('rejects cash methods linked to Accounts Receivable', async () => {
      repoMocks.findById.mockResolvedValue({
        id: 'payment-method-1',
        code: PaymentMethodType.CASH,
        name: 'Tunai',
        type: PaymentMethodType.CASH,
        accountId: 'cash-account',
      });
      repoMocks.findAccountById.mockResolvedValue({
        id: 'receivable-account',
        code: '1100',
        name: 'Accounts Receivable',
      });

      await expect(
        paymentMethodService.update({
          id: 'payment-method-1',
          companyId,
          data: { accountId: 'receivable-account' },
        })
      ).rejects.toThrow(
        'CASH payment method cannot use account 1100 Accounts Receivable'
      );

      expect(repoMocks.update).not.toHaveBeenCalled();
    });
  });
});
