import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvoiceService } from '@modules/accounting/services/invoice.service';
import { InvoiceStatus, InvoiceType } from '@sync-erp/database';

// Mock dependencies
vi.mock('@modules/common/services/idempotency.service');
vi.mock('@modules/accounting/repositories/invoice.repository');
vi.mock('@modules/accounting/services/journal.service');
vi.mock('@modules/common/services/document-number.service');
vi.mock('@modules/inventory/inventory.service');

describe('T016: Credit Note (Reversal)', () => {
  let service: InvoiceService;
  let mockRepo: any;
  let mockJournal: any;
  let mockDocService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new InvoiceService();
    mockRepo = (service as any).repository;
    mockJournal = (service as any).journalService;
    mockDocService = (service as any).documentNumberService;
  });

  const companyId = 'co-1';
  const originalId = 'inv-1';

  it('should create credit note and post journal', async () => {
    // 1. Mock Find Original
    mockRepo.findById.mockResolvedValue({
      id: originalId,
      status: InvoiceStatus.POSTED,
      amount: 100,
      subtotal: 90,
      taxAmount: 10,
      taxRate: 10,
      partnerId: 'cust-1',
      createdAt: new Date(), // Add createdAt for policy age check
    });

    // 2. Mock Generate Number
    mockDocService.generate.mockResolvedValue('CN-001');

    // 3. Mock Create CN
    mockRepo.create.mockResolvedValue({
      id: 'cn-1',
      invoiceNumber: 'CN-001',
      type: InvoiceType.CREDIT_NOTE,
      amount: 100,
      subtotal: 90,
      taxAmount: 10,
    });

    const result = await service.createCreditNote(
      companyId,
      originalId
    );

    // Verify Create called with correct mapping
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: InvoiceType.CREDIT_NOTE,
        relatedInvoiceId: originalId,
        amount: 100,
        partnerId: 'cust-1',
      })
    );

    // Verify Journal Post
    expect(mockJournal.postCreditNote).toHaveBeenCalledWith(
      companyId,
      'cn-1',
      'CN-001',
      100,
      90,
      10
    );

    expect(result.id).toBe('cn-1');
  });

  it('should fail if original invoice not found', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(
      service.createCreditNote(companyId, originalId)
    ).rejects.toThrow('Original invoice not found');
  });

  it('should fail if original is DRAFT', async () => {
    mockRepo.findById.mockResolvedValue({
      id: originalId,
      status: InvoiceStatus.DRAFT,
      createdAt: new Date(),
    });
    await expect(
      service.createCreditNote(companyId, originalId)
    ).rejects.toThrow(/Cannot reverse invoice with status DRAFT/);
  });
});
