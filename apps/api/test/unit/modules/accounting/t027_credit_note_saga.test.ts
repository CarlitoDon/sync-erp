import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  prisma,
  SagaType,
  SagaStep,
  InvoiceStatus,
} from '@sync-erp/database';
import { CreditNoteSaga } from '../../../../src/modules/accounting/sagas/credit-note.saga';
import { SagaCompensatedError } from '../../../../src/modules/common/saga/saga-errors';

vi.mock('@sync-erp/database', async () => {
  const actual = await vi.importActual('@sync-erp/database');

  const mockSagaLog = {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  };
  const mockInvoice = { findFirst: vi.fn(), update: vi.fn() };
  const mockAccount = { findFirst: vi.fn() };
  const mockJournalEntry = { create: vi.fn(), update: vi.fn() };

  const prismaMock = {
    sagaLog: mockSagaLog,
    invoice: mockInvoice,
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

describe('T027: Credit Note Saga', () => {
  let saga: CreditNoteSaga;

  const mockInvoice = {
    id: 'inv-1',
    companyId: 'co-1',
    invoiceNumber: 'INV-001',
    status: InvoiceStatus.POSTED,
    balance: 1000,
  };

  const mockSagaLog = {
    id: 'saga-1',
    sagaType: SagaType.CREDIT_NOTE,
    entityId: 'inv-1',
    companyId: 'co-1',
    step: SagaStep.PENDING,
    stepData: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    saga = new CreditNoteSaga();
    vi.mocked(prisma.sagaLog.create).mockResolvedValue(
      mockSagaLog as any
    );
    vi.mocked(prisma.sagaLog.update).mockResolvedValue({} as any);
    vi.mocked(prisma.sagaLog.findFirst).mockResolvedValue(null);
  });

  describe('Successful Execution', () => {
    it('should create credit note with reversing journal', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue(
        mockInvoice as any
      );
      vi.mocked(prisma.invoice.update).mockResolvedValue({
        ...mockInvoice,
        balance: 800,
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
          amount: 200,
          reason: 'Discount',
        },
        'inv-1',
        'co-1'
      );

      expect(result.success).toBe(true);
      expect(result.data?.balance).toBe(800);
    });
  });

  describe('Idempotency', () => {
    it('should return cached result if saga already completed', async () => {
      vi.mocked(prisma.sagaLog.findFirst).mockResolvedValue({
        ...mockSagaLog,
        status: SagaStep.COMPLETED,
        step: SagaStep.COMPLETED,
        result: {
          success: true,
          sagaLogId: 'saga-1',
          data: { balance: 800 },
        },
      } as any);

      const result = await saga.execute(
        {
          invoiceId: 'inv-1',
          companyId: 'co-1',
          amount: 200,
          reason: 'Discount',
        },
        'inv-1',
        'co-1'
      );

      expect(result.success).toBe(true);
      expect(result.sagaLogId).toBe('saga-1');
      expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    });
  });

  describe('Validation', () => {
    it('should fail on voided invoice', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
        ...mockInvoice,
        status: InvoiceStatus.VOID,
      } as any);

      await expect(
        saga.execute(
          {
            invoiceId: 'inv-1',
            companyId: 'co-1',
            amount: 100,
            reason: 'Test',
          },
          'inv-1',
          'co-1'
        )
      ).rejects.toThrow(SagaCompensatedError);
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
            reason: 'Test',
          },
          'inv-1',
          'co-1'
        )
      ).rejects.toThrow(/Multi-currency .* is disabled in Phase 1/);
    });
  });
});
