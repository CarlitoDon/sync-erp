import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  prisma,
  SagaType,
  SagaStep,
  InvoiceStatus,
} from '@sync-erp/database';
import { InvoicePostingSaga } from '../../../../src/modules/accounting/sagas/invoice-posting.saga';
import { SagaCompensatedError } from '../../../../src/modules/common/saga/saga-errors';

// Mock all dependencies
vi.mock('@sync-erp/database', async () => {
  const actual = await vi.importActual('@sync-erp/database');

  // Create mock methods
  const mockSagaLog = {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  };
  const mockInvoice = {
    findFirst: vi.fn(),
    update: vi.fn(),
  };
  const mockOrder = {
    findFirst: vi.fn(),
    update: vi.fn(),
  };
  const mockOrderItem = {
    update: vi.fn(),
  };
  const mockProduct = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  };
  const mockInventoryMovement = {
    create: vi.fn(),
    findMany: vi.fn(),
  };
  const mockAccount = {
    findFirst: vi.fn(),
  };
  const mockJournalEntry = {
    create: vi.fn(),
  };
  const mockJournalLine = {
    create: vi.fn(),
  };

  // Build prisma object with $transaction that passes all models to tx
  const prismaMock = {
    sagaLog: mockSagaLog,
    invoice: mockInvoice,
    order: mockOrder,
    orderItem: mockOrderItem,
    product: mockProduct,
    inventoryMovement: mockInventoryMovement,
    account: mockAccount,
    journalEntry: mockJournalEntry,
    journalLine: mockJournalLine,
    $transaction: vi
      .fn()
      .mockImplementation(
        async (callback: (tx: any) => Promise<any>) => {
          // Pass a tx that includes all model mocks plus $executeRawUnsafe
          const mockTx = {
            ...prismaMock,
            $executeRawUnsafe: vi.fn().mockResolvedValue(1),
          };
          return callback(mockTx);
        }
      ),
  };

  return {
    ...actual,
    prisma: prismaMock,
  };
});

describe('T022: Invoice Posting Saga', () => {
  let saga: InvoicePostingSaga;

  const mockInvoice = {
    id: 'inv-1',
    companyId: 'co-1',
    orderId: 'order-1',
    invoiceNumber: 'INV-001',
    status: InvoiceStatus.DRAFT,
    amount: 1000,
    subtotal: 900,
    taxAmount: 100,
    balance: 1000,
  };

  const mockSagaLog = {
    id: 'saga-1',
    sagaType: SagaType.INVOICE_POST,
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
    saga = new InvoicePostingSaga();

    // Default saga log mock
    vi.mocked(prisma.sagaLog.create).mockResolvedValue(mockSagaLog);
    vi.mocked(prisma.sagaLog.update).mockResolvedValue({} as any);
  });

  describe('Successful Execution', () => {
    it('should post invoice with stock and journal steps', async () => {
      // Mock invoice lookup
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue(
        mockInvoice as any
      );
      vi.mocked(prisma.invoice.update).mockResolvedValue({
        ...mockInvoice,
        status: InvoiceStatus.POSTED,
      } as any);

      // Mock order with items (for shipment)
      vi.mocked(prisma.order.findFirst).mockResolvedValue({
        id: 'order-1',
        items: [{ productId: 'prod-1', quantity: 10, price: 90 }],
      } as any);

      // Mock product for shipment
      const mockProduct = {
        id: 'prod-1',
        stockQty: 100,
        averageCost: 10,
        isService: false,
      };
      vi.mocked(prisma.product.findUnique).mockResolvedValue(
        mockProduct as any
      );
      vi.mocked(prisma.product.findFirst).mockResolvedValue(
        mockProduct as any
      );
      vi.mocked(prisma.product.update).mockResolvedValue({} as any);

      // Mock inventory movement
      vi.mocked(prisma.inventoryMovement.create).mockResolvedValue({
        id: 'mov-1',
      } as any);
      vi.mocked(prisma.inventoryMovement.findMany).mockResolvedValue(
        []
      );

      // Mock account and journal
      vi.mocked(prisma.account.findFirst).mockResolvedValue({
        id: 'acc-1',
      } as any);
      vi.mocked(prisma.journalEntry.create).mockResolvedValue({
        id: 'jnl-1',
      } as any);

      const result = await saga.execute(
        { invoiceId: 'inv-1', companyId: 'co-1' },
        'inv-1',
        'co-1'
      );

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe(InvoiceStatus.POSTED);
      expect(result.sagaLogId).toBe('saga-1');
    });

    it('should track saga steps correctly', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
        ...mockInvoice,
        orderId: null, // No order = no shipment
      } as any);
      vi.mocked(prisma.invoice.update).mockResolvedValue({
        ...mockInvoice,
        orderId: null,
        status: InvoiceStatus.POSTED,
      } as any);

      // Mock journal
      vi.mocked(prisma.account.findFirst).mockResolvedValue({
        id: 'acc-1',
      } as any);
      vi.mocked(prisma.journalEntry.create).mockResolvedValue({
        id: 'jnl-1',
      } as any);

      await saga.execute(
        { invoiceId: 'inv-1', companyId: 'co-1' },
        'inv-1',
        'co-1'
      );

      // Verify saga log was updated
      expect(prisma.sagaLog.update).toHaveBeenCalled();
    });
  });

  describe('Failure and Compensation', () => {
    it('should throw SagaCompensatedError when journal fails', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
        ...mockInvoice,
        orderId: null,
      } as any);
      vi.mocked(prisma.invoice.update).mockResolvedValue({
        ...mockInvoice,
        orderId: null,
        status: InvoiceStatus.POSTED,
      } as any);

      // Journal fails
      vi.mocked(prisma.account.findFirst).mockResolvedValue({
        id: 'acc-1',
      } as any);
      vi.mocked(prisma.journalEntry.create).mockRejectedValue(
        new Error('Journal creation failed')
      );

      await expect(
        saga.execute(
          { invoiceId: 'inv-1', companyId: 'co-1' },
          'inv-1',
          'co-1'
        )
      ).rejects.toThrow(SagaCompensatedError);
    });

    it('should revert invoice status on compensation', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
        ...mockInvoice,
        orderId: null,
      } as any);
      vi.mocked(prisma.invoice.update)
        .mockResolvedValueOnce({
          ...mockInvoice,
          orderId: null,
          status: InvoiceStatus.POSTED,
        } as any)
        .mockResolvedValueOnce({
          ...mockInvoice,
          orderId: null,
          status: InvoiceStatus.DRAFT,
        } as any);

      vi.mocked(prisma.account.findFirst).mockResolvedValue({
        id: 'acc-1',
      } as any);
      vi.mocked(prisma.journalEntry.create).mockRejectedValue(
        new Error('Journal creation failed')
      );

      try {
        await saga.execute(
          { invoiceId: 'inv-1', companyId: 'co-1' },
          'inv-1',
          'co-1'
        );
      } catch {
        // Expected
      }

      // Verify invoice was reverted to DRAFT
      expect(prisma.invoice.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: { status: 'DRAFT' },
        })
      );
    });
  });

  describe('Validation', () => {
    it('should fail on non-existent invoice', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null);

      await expect(
        saga.execute(
          { invoiceId: 'inv-999', companyId: 'co-1' },
          'inv-999',
          'co-1'
        )
      ).rejects.toThrow(SagaCompensatedError);
    });

    it('should fail on non-DRAFT invoice', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
        ...mockInvoice,
        status: InvoiceStatus.POSTED,
      } as any);

      await expect(
        saga.execute(
          { invoiceId: 'inv-1', companyId: 'co-1' },
          'inv-1',
          'co-1'
        )
      ).rejects.toThrow(SagaCompensatedError);
    });
  });
});
