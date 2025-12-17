import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvoicePostingSaga } from '../../../../src/modules/accounting/sagas/invoice-posting.saga';
import { InvoiceRepository } from '../../../../src/modules/accounting/repositories/invoice.repository';
import { InventoryService } from '../../../../src/modules/inventory/inventory.service';
import { JournalService } from '../../../../src/modules/accounting/services/journal.service';
import { InvoiceStatus } from '@sync-erp/database';

// Mocks
vi.mock(
  '../../../../src/modules/accounting/repositories/invoice.repository'
);
vi.mock('../../../../src/modules/inventory/inventory.service');
vi.mock(
  '../../../../src/modules/accounting/services/journal.service'
);
vi.mock('../../../../src/modules/common/saga', () => {
  const actual = vi.importActual(
    '../../../../src/modules/common/saga'
  );
  return {
    ...actual,
    SagaOrchestrator: class MockOrchestrator {
      sagaType = 'INVOICE_POST';
      async execute(_input: any, _entityId: any, _companyId: any) {
        // We'll reimplement basic flow or just test compensate directly
        // But since we want to test the REAL saga logic, we shouldn't mock the orchestrator base class
        // unless we want to bypass DB calls.
        // Actually, we should NOT mock SagaOrchestrator if we are testing InvoicePostingSaga which extends it.
        // We need to mock the dependencies and let the saga run.
      }
    },
    // Mock PostingContext to avoid DB calls
    PostingContext: {
      create: vi.fn().mockResolvedValue({
        id: 'saga-123',
        markStockDone: vi.fn(),
        markJournalDone: vi.fn(),
        markCompleted: vi.fn(),
        markFailed: vi.fn(),
        markCompensationFailed: vi.fn(),
        stepData: { stockMovementId: 'mov-123' }, // Simulate stock already done for compensation test
        entityId: 'inv-123',
        companyId: 'comp-123',
      }),
    },
  };
});

describe('T025: Stock Compensation (B2)', () => {
  let saga: InvoicePostingSaga;
  let mockInvoiceRepo: any;
  let mockInventoryService: any;
  let mockJournalService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoiceRepo = new InvoiceRepository();
    mockInventoryService = new InventoryService();
    mockJournalService = new JournalService();

    saga = new InvoicePostingSaga();
    // Inject mocks (private properties)
    (saga as any).invoiceRepository = mockInvoiceRepo;
    (saga as any).inventoryService = mockInventoryService;
    (saga as any).journalService = mockJournalService;
  });

  it('should call processReturn when compensating a saga with shipped stock', async () => {
    // Setup Context with stockMovementId (simulating failure after shipping)
    const mockContext = {
      id: 'saga-log-1',
      entityId: 'inv-123',
      companyId: 'comp-123',
      stepData: { stockMovementId: 'mov-1' }, // Critical: This flags that stock needs reversal
      markStockDone: vi.fn(),
      markJournalDone: vi.fn(),
      markCompleted: vi.fn(),
      markFailed: vi.fn(),
    };

    // Setup Invoice with Order and Items (returned by InvoiceRepository)
    mockInvoiceRepo.findById.mockResolvedValue({
      id: 'inv-123',
      invoiceNumber: 'INV-001',
      orderId: 'ord-123',
      status: InvoiceStatus.POSTED, // Was posted, now rolling back
      order: {
        id: 'ord-123',
        items: [
          { productId: 'prod-A', quantity: 5 },
          { productId: 'prod-B', quantity: 3 },
        ],
      },
    });

    // Invoke compensate directly (accessing protected method)
    await (saga as any).compensate(mockContext);

    // Verify Invoice Lookup
    expect(mockInvoiceRepo.findById).toHaveBeenCalledWith(
      'inv-123',
      'comp-123',
      'INVOICE'
    );

    // Verify Process Return Call (The core fix)
    expect(mockInventoryService.processReturn).toHaveBeenCalledWith(
      'comp-123',
      'ord-123', // Order ID
      [
        { productId: 'prod-A', quantity: 5 },
        { productId: 'prod-B', quantity: 3 },
      ], // Mapped Items
      expect.stringContaining('Saga compensation for Invoice INV-001') // Reference
    );

    // Verify Invoice Status Revert
    expect(mockInvoiceRepo.update).toHaveBeenCalledWith('inv-123', {
      status: InvoiceStatus.DRAFT,
    });
  });

  it('should log warning if invoice/order not found during compensation', async () => {
    const mockContext = {
      id: 'saga-log-1',
      entityId: 'inv-123',
      companyId: 'comp-123',
      stepData: { stockMovementId: 'mov-1' },
    };

    // Return null (invoice missing)
    mockInvoiceRepo.findById.mockResolvedValue(null);
    const consoleSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {});

    await (saga as any).compensate(mockContext);

    expect(mockInventoryService.processReturn).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Could not restore stock')
    );
  });
});
