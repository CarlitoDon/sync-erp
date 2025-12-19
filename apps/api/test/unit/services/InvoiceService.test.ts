import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  mockInvoiceRepository,
  resetRepositoryMocks,
} from '../mocks/repositories.mock';

// Mock JournalService
const mockJournalService = {
  postInvoice: vi.fn().mockResolvedValue({}),
};
vi.mock(
  '../../../src/modules/accounting/services/journal.service',
  () => ({
    JournalService: function () {
      return mockJournalService;
    },
  })
);

// Mock DocumentNumberService
const mockDocumentNumberService = {
  generate: vi.fn().mockResolvedValue('INV-00001'),
};
vi.mock(
  '../../../src/modules/common/services/document-number.service',
  () => ({
    DocumentNumberService: function () {
      return mockDocumentNumberService;
    },
  })
);

// Mock InvoicePostingSaga
const mockInvoicePostingSaga = {
  execute: vi.fn(),
};
vi.mock(
  '../../../src/modules/accounting/sagas/invoice-posting.saga',
  () => ({
    InvoicePostingSaga: function () {
      return mockInvoicePostingSaga;
    },
  })
);

// Mock InvoiceRepository
vi.mock(
  '../../../src/modules/accounting/repositories/invoice.repository',
  () => ({
    InvoiceRepository: function () {
      return mockInvoiceRepository;
    },
  })
);

// Import after mocking
import { InvoiceService } from '../../../src/modules/accounting/services/invoice.service';

describe('InvoiceService', () => {
  let service: InvoiceService;
  const companyId = 'company-1';

  beforeEach(() => {
    resetRepositoryMocks();
    vi.clearAllMocks();
    service = new InvoiceService();
  });

  describe('createFromSalesOrder', () => {
    it('should create an invoice from a sales order', async () => {
      const mockOrder = {
        id: 'order-1',
        companyId,
        type: 'SALES',
        status: 'CONFIRMED', // Policy requires CONFIRMED status
        totalAmount: 1000,
        taxRate: 11,
        partnerId: 'partner-1',
        items: [],
        partner: { id: 'partner-1', name: 'Customer' },
      };

      const mockInvoice = {
        id: 'inv-1',
        companyId,
        orderId: 'order-1',
        type: 'INVOICE',
        status: 'DRAFT',
        amount: 1110,
        invoiceNumber: 'INV-00001',
      };

      mockInvoiceRepository.findOrder.mockResolvedValue(mockOrder);
      mockInvoiceRepository.count.mockResolvedValue(0);
      mockInvoiceRepository.create.mockResolvedValue(mockInvoice);

      const result = await service.createFromSalesOrder(companyId, {
        orderId: 'order-1',
      });

      expect(result).toEqual(mockInvoice);
    });

    it('should throw error if sales order not found', async () => {
      mockInvoiceRepository.findOrder.mockResolvedValue(null);

      await expect(
        service.createFromSalesOrder(companyId, {
          orderId: 'nonexistent',
        })
      ).rejects.toThrow('Sales order not found');
    });
  });

  describe('getById', () => {
    it('should return an invoice by ID', async () => {
      const mockInvoice = { id: 'inv-1', companyId, type: 'INVOICE' };
      mockInvoiceRepository.findById.mockResolvedValue(mockInvoice);

      const result = await service.getById('inv-1', companyId);

      expect(result).toEqual(mockInvoice);
    });

    it('should return null for non-existent invoice', async () => {
      mockInvoiceRepository.findById.mockResolvedValue(null);

      const result = await service.getById('nonexistent', companyId);

      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('should list all invoices', async () => {
      const mockInvoices = [
        { id: 'inv-1', type: 'INVOICE' },
        { id: 'inv-2', type: 'INVOICE' },
      ];
      mockInvoiceRepository.findAll.mockResolvedValue(mockInvoices);

      const result = await service.list(companyId);

      expect(result).toHaveLength(2);
    });

    it('should filter by status', async () => {
      const mockInvoices = [{ id: 'inv-1', status: 'POSTED' }];
      mockInvoiceRepository.findAll.mockResolvedValue(mockInvoices);

      const result = await service.list(companyId, 'POSTED');

      expect(result).toHaveLength(1);
    });
  });

  describe('post', () => {
    it('should delegate to InvoicePostingSaga', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        companyId,
        status: 'DRAFT', // Must be draft for guard
      };

      // Mock findById for state guard
      mockInvoiceRepository.findById.mockResolvedValue(mockInvoice);

      mockInvoicePostingSaga.execute.mockResolvedValue({
        success: true,
        data: { ...mockInvoice, status: 'POSTED' },
      });

      const result = await service.post('invoice-1', companyId);

      expect(result).toEqual({ ...mockInvoice, status: 'POSTED' });
      expect(mockInvoicePostingSaga.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId: 'invoice-1',
          companyId,
        }),
        'invoice-1',
        companyId,
        undefined // correlationId
      );
    });

    it('should throw error if saga fails', async () => {
      // Mock findById for state guard
      mockInvoiceRepository.findById.mockResolvedValue({
        id: 'invoice-1',
        companyId,
        status: 'DRAFT',
      });

      mockInvoicePostingSaga.execute.mockResolvedValue({
        success: false,
        error: new Error('Saga failed'),
      });

      await expect(
        service.post('invoice-1', companyId)
      ).rejects.toThrow('Saga failed');
    });
  });

  describe('void', () => {
    it('should void an invoice', async () => {
      const mockInvoice = { id: 'inv-1', companyId, status: 'DRAFT' };
      const voidedInvoice = { ...mockInvoice, status: 'VOID' };

      mockInvoiceRepository.findById.mockResolvedValue(mockInvoice);
      mockInvoiceRepository.update.mockResolvedValue(voidedInvoice);

      const result = await service.void('inv-1', companyId);

      expect(result.status).toBe('VOID');
    });

    it('should throw error if invoice not found', async () => {
      mockInvoiceRepository.findById.mockResolvedValue(null);

      await expect(
        service.void('nonexistent', companyId)
      ).rejects.toThrow('Invoice not found');
    });

    it('should throw error if invoice is already paid', async () => {
      const mockInvoice = { id: 'inv-1', status: 'PAID' };
      mockInvoiceRepository.findById.mockResolvedValue(mockInvoice);

      await expect(service.void('inv-1', companyId)).rejects.toThrow(
        'Cannot void a paid invoice'
      );
    });
  });

  describe('getOutstanding', () => {
    it('should return outstanding invoices', async () => {
      const mockInvoices = [{ id: 'inv-1', status: 'POSTED' }];
      mockInvoiceRepository.findAll.mockResolvedValue(mockInvoices);

      const result = await service.getOutstanding(companyId);

      expect(result).toHaveLength(1);
    });
  });

  describe('getRemainingAmount', () => {
    it('should return the balance field', async () => {
      const mockInvoice = {
        id: 'inv-1',
        amount: 1000,
        balance: 500,
      };
      mockInvoiceRepository.findById.mockResolvedValue(mockInvoice);

      const result = await service.getRemainingAmount(
        'inv-1',
        companyId
      );

      expect(result).toBe(500);
    });

    it('should throw error if invoice not found', async () => {
      mockInvoiceRepository.findById.mockResolvedValue(null);

      await expect(
        service.getRemainingAmount('nonexistent', companyId)
      ).rejects.toThrow('Invoice not found');
    });
  });
});
