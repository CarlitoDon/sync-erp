import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  prisma,
  SagaType,
  SagaStep,
  InvoiceStatus,
} from '@sync-erp/database';
import { PaymentPostingSaga } from '../../../../src/modules/accounting/sagas/payment-posting.saga';
import { SagaCompensatedError } from '../../../../src/modules/common/saga/saga-errors';

// Mock all dependencies
vi.mock('@sync-erp/database', async () => {
  const actual = await vi.importActual('@sync-erp/database');

  const mockSagaLog = {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  };
  const mockInvoice = { findFirst: vi.fn(), update: vi.fn() };
  const mockPayment = { create: vi.fn() };
  const mockAccount = { findFirst: vi.fn() };
  const mockJournalEntry = { create: vi.fn(), update: vi.fn() };

  const prismaMock = {
    sagaLog: mockSagaLog,
    invoice: mockInvoice,
    payment: mockPayment,
    account: mockAccount,
    journalEntry: mockJournalEntry,
    $transaction: vi
      .fn()
      .mockImplementation(
        async (callback: (tx: any) => Promise<any>) => {
          const mockTx = {
            ...prismaMock,
            $executeRawUnsafe: vi.fn().mockResolvedValue(1),
          };
          return callback(mockTx);
        }
      ),
  };

  return { ...actual, prisma: prismaMock };
});

describe('T026: Payment Posting Saga', () => {
  let saga: PaymentPostingSaga;

  const mockInvoice = {
    id: 'inv-1',
    companyId: 'co-1',
    invoiceNumber: 'INV-001',
    status: InvoiceStatus.POSTED,
    amount: 1000,
    balance: 1000,
  };

  const mockSagaLog = {
    id: 'saga-1',
    sagaType: SagaType.PAYMENT_POST,
    entityId: 'inv-1',
    companyId: 'co-1',
    step: SagaStep.PENDING,
    stepData: {},
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    saga = new PaymentPostingSaga();

    vi.mocked(prisma.sagaLog.create).mockResolvedValue(mockSagaLog);
    vi.mocked(prisma.sagaLog.update).mockResolvedValue({} as any);
  });

  describe('Successful Execution', () => {
    it('should create payment with balance decrease and journal', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue(
        mockInvoice as any
      );
      vi.mocked(prisma.invoice.update).mockResolvedValue({
        ...mockInvoice,
        balance: 500,
      } as any);

      vi.mocked(prisma.payment.create).mockResolvedValue({
        id: 'pay-1',
        invoiceId: 'inv-1',
        amount: 500,
        method: 'bank_transfer',
      } as any);

      vi.mocked(prisma.account.findFirst).mockResolvedValue({
        id: 'acc-1',
      } as any);
      vi.mocked(prisma.journalEntry.create).mockResolvedValue({
        id: 'jnl-1',
      } as any);

      const result = await saga.execute(
        {
          invoiceId: 'inv-1',
          companyId: 'co-1',
          amount: 500,
          method: 'bank_transfer',
        },
        'inv-1',
        'co-1'
      );

      expect(result.success).toBe(true);
      expect(result.data?.amount).toBe(500);
      expect(result.sagaLogId).toBe('saga-1');
    });
  });

  describe('Validation', () => {
    it('should fail on non-existent invoice', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null);

      await expect(
        saga.execute(
          {
            invoiceId: 'inv-999',
            companyId: 'co-1',
            amount: 100,
            method: 'cash',
          },
          'inv-999',
          'co-1'
        )
      ).rejects.toThrow(SagaCompensatedError);
    });

    it('should fail when payment exceeds balance', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue(
        mockInvoice as any
      );

      await expect(
        saga.execute(
          {
            invoiceId: 'inv-1',
            companyId: 'co-1',
            amount: 1500,
            method: 'cash',
          },
          'inv-1',
          'co-1'
        )
      ).rejects.toThrow(SagaCompensatedError);
    });

    it('should fail on backdated payment (Phase 1 Restriction)', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 2); // 2 days ago

      vi.mocked(prisma.invoice.findFirst).mockResolvedValue(
        mockInvoice as any
      );

      await expect(
        saga.execute(
          {
            invoiceId: 'inv-1',
            companyId: 'co-1',
            amount: 100,
            method: 'cash',
            businessDate: pastDate,
          },
          'inv-1',
          'co-1'
        )
      ).rejects.toThrow(
        /Backdated transactions are disabled in Phase 1/
      );
    });

    it('should fail on non-Base currency (Phase 1 Restriction)', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
        ...mockInvoice,
        currency: 'USD',
      } as any);

      await expect(
        saga.execute(
          {
            invoiceId: 'inv-1',
            companyId: 'co-1',
            amount: 100,
            method: 'cash',
          },
          'inv-1',
          'co-1'
        )
      ).rejects.toThrow(/Multi-currency .* is disabled in Phase 1/);
    });
  });

  describe('Compensation', () => {
    it('should restore balance on journal failure', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue(
        mockInvoice as any
      );
      vi.mocked(prisma.invoice.update).mockResolvedValue({
        ...mockInvoice,
        balance: 500,
      } as any);

      vi.mocked(prisma.payment.create).mockResolvedValue({
        id: 'pay-1',
        amount: 500,
      } as any);

      vi.mocked(prisma.account.findFirst).mockResolvedValue({
        id: 'acc-1',
      } as any);
      vi.mocked(prisma.journalEntry.create).mockRejectedValue(
        new Error('Journal creation failed')
      );

      await expect(
        saga.execute(
          {
            invoiceId: 'inv-1',
            companyId: 'co-1',
            amount: 500,
            method: 'cash',
          },
          'inv-1',
          'co-1'
        )
      ).rejects.toThrow(SagaCompensatedError);
    });
  });
});
