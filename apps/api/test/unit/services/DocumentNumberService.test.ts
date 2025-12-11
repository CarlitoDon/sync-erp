import { vi } from 'vitest';
import { mockPrisma, resetMocks } from '../mocks/prisma.mock';

// Mock the database module

// Import after mocking
import { DocumentNumberService } from '../../../src/services/DocumentNumberService';

describe('DocumentNumberService', () => {
  let service: DocumentNumberService;
  const companyId = 'company-1';

  beforeEach(() => {
    resetMocks();
    service = new DocumentNumberService();
    // Mock order and invoice counts
    mockPrisma.order.count.mockResolvedValue(0);
    mockPrisma.invoice.count.mockResolvedValue(0);
    mockPrisma.journalEntry.count.mockResolvedValue(0);
  });

  describe('generate', () => {
    it('should generate a PO number', async () => {
      mockPrisma.order.count.mockResolvedValue(5);

      const result = await service.generate(companyId, 'PO');

      expect(result).toMatch(/^PO-\d{4}-00006$/);
    });

    it('should generate a SO number', async () => {
      mockPrisma.order.count.mockResolvedValue(10);

      const result = await service.generate(companyId, 'SO');

      expect(result).toMatch(/^SO-\d{4}-00011$/);
    });

    it('should generate an INV number', async () => {
      mockPrisma.invoice.count.mockResolvedValue(3);

      const result = await service.generate(companyId, 'INV');

      expect(result).toMatch(/^INV-\d{4}-00004$/);
    });

    it('should generate a BILL number', async () => {
      mockPrisma.invoice.count.mockResolvedValue(7);

      const result = await service.generate(companyId, 'BILL');

      expect(result).toMatch(/^BILL-\d{4}-00008$/);
    });

    it('should generate a JE number', async () => {
      mockPrisma.journalEntry.count.mockResolvedValue(99);

      const result = await service.generate(companyId, 'JE');

      expect(result).toMatch(/^JE-\d{4}-00100$/);
    });

    it('should pad sequence numbers correctly', async () => {
      mockPrisma.order.count.mockResolvedValue(0);

      const result = await service.generate(companyId, 'PO');

      expect(result).toMatch(/00001$/);
    });
  });

  describe('parse', () => {
    it('should parse a document number with year', () => {
      const result = service.parse('INV-2025-00001');

      expect(result).toEqual({
        prefix: 'INV',
        year: '2025',
        sequence: '00001',
      });
    });

    it('should parse a document number without year', () => {
      const result = service.parse('PO-00001');

      expect(result).toEqual({
        prefix: 'PO',
        sequence: '00001',
      });
    });

    it('should return null for invalid format', () => {
      const result = service.parse('INVALID');

      expect(result).toBeNull();
    });

    it('should parse document number with 2-digit year', () => {
      const result = service.parse('SO-25-00001');

      expect(result).toEqual({
        prefix: 'SO',
        year: '25',
        sequence: '00001',
      });
    });
  });
});
