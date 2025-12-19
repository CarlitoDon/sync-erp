import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  prisma,
  SagaType,
  SagaStep,
  InvoiceStatus,
} from '@sync-erp/database';
import { BillPostingSaga } from '@modules/accounting/sagas/bill-posting.saga';
import { SagaCompensatedError } from '@modules/common/saga/saga-errors';

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

describe('T025: Bill Posting Saga', () => {
  let saga: BillPostingSaga;

  const mockBill = {
    id: 'bill-1',
    companyId: 'co-1',
    invoiceNumber: 'BILL-001',
    status: InvoiceStatus.DRAFT,
    amount: 500,
    subtotal: 450,
    taxAmount: 50,
    balance: 500,
  };

  const mockSagaLog = {
    id: 'saga-1',
    sagaType: SagaType.BILL_POST,
    entityId: 'bill-1',
    companyId: 'co-1',
    step: SagaStep.PENDING,
    stepData: {},
    error: null,
    correlationId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    saga = new BillPostingSaga();

    vi.mocked(prisma.sagaLog.create).mockResolvedValue(mockSagaLog);
    vi.mocked(prisma.sagaLog.update).mockResolvedValue({} as any);
    vi.mocked(prisma.sagaLog.findFirst).mockResolvedValue(null);
  });

  describe('Successful Execution', () => {
    it('should post bill with AP journal', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue(
        mockBill as any
      );
      vi.mocked(prisma.invoice.update).mockResolvedValue({
        ...mockBill,
        status: InvoiceStatus.POSTED,
      } as any);

      vi.mocked(prisma.account.findFirst).mockResolvedValue({
        id: 'acc-1',
      } as any);
      vi.mocked(prisma.journalEntry.create).mockResolvedValue({
        id: 'jnl-1',
      } as any);

      const result = await saga.execute(
        { billId: 'bill-1', companyId: 'co-1' },
        'bill-1',
        'co-1'
      );

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe(InvoiceStatus.POSTED);
      expect(result.sagaLogId).toBe('saga-1');
    });
  });

  describe('Idempotency', () => {
    it('should return cached result if saga already completed', async () => {
      vi.mocked(prisma.sagaLog.findFirst).mockResolvedValue({
        ...mockSagaLog,
        status: SagaStep.COMPLETED,
        step: SagaStep.COMPLETED,
        result: { success: true, sagaLogId: 'saga-1' },
      } as any);

      const result = await saga.execute(
        { billId: 'bill-1', companyId: 'co-1' },
        'bill-1',
        'co-1'
      );

      expect(result.success).toBe(true);
      expect(result.sagaLogId).toBe('saga-1');
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });
  });

  describe('Validation', () => {
    it('should fail on non-existent bill', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null);

      await expect(
        saga.execute(
          { billId: 'bill-999', companyId: 'co-1' },
          'bill-999',
          'co-1'
        )
      ).rejects.toThrow(SagaCompensatedError);
    });

    it('should fail on non-DRAFT bill', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
        ...mockBill,
        status: InvoiceStatus.POSTED,
      } as any);

      await expect(
        saga.execute(
          { billId: 'bill-1', companyId: 'co-1' },
          'bill-1',
          'co-1'
        )
      ).rejects.toThrow(SagaCompensatedError);
    });

    it('should fail on non-Base currency (Phase 1 Restriction)', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
        ...mockBill,
        currency: 'USD', // Not IDR
      } as any);

      await expect(
        saga.execute(
          { billId: 'bill-1', companyId: 'co-1' },
          'bill-1',
          'co-1'
        )
      ).rejects.toThrow(/Multi-currency .* is disabled in Phase 1/);
    });
  });

  describe('Compensation', () => {
    it('should revert bill status on journal failure', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue(
        mockBill as any
      );
      vi.mocked(prisma.invoice.update).mockResolvedValue({
        ...mockBill,
        status: InvoiceStatus.POSTED,
      } as any);

      vi.mocked(prisma.account.findFirst).mockResolvedValue({
        id: 'acc-1',
      } as any);
      vi.mocked(prisma.journalEntry.create).mockRejectedValue(
        new Error('Journal creation failed')
      );

      await expect(
        saga.execute(
          { billId: 'bill-1', companyId: 'co-1' },
          'bill-1',
          'co-1'
        )
      ).rejects.toThrow(SagaCompensatedError);
    });
  });
});
