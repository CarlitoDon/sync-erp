import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JournalService } from '../../../../src/modules/accounting/services/journal.service';

// Mock dependencies
vi.mock(
  '../../../../src/modules/accounting/services/account.service'
);
vi.mock(
  '../../../../src/modules/accounting/repositories/journal.repository'
);

describe('T018: Journal Reversal', () => {
  let service: JournalService;
  let mockRepo: any;
  let mockAccountService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new JournalService();
    mockRepo = (service as any).repository;
    mockAccountService = (service as any).accountService;
  });

  const companyId = 'co-1';
  const journalId = 'je-1';

  it('should reverse journal entry correctly', async () => {
    // 1. Mock Find Original
    mockRepo.findById.mockResolvedValue({
      id: journalId,
      reference: 'REF-001',
      lines: [
        { accountId: 'acc-1', debit: 100, credit: 0 },
        { accountId: 'acc-2', debit: 0, credit: 100 },
      ],
    });

    // 2. Mock Account Get (Create calls getById)
    mockAccountService.getById.mockImplementation((id: string) => ({
      id,
    }));

    // 3. Mock Create
    mockRepo.create.mockResolvedValue({
      id: 'je-2',
      reference: 'Reversal: REF-001',
    });

    const result = await service.reverse(companyId, journalId);

    // Verify Create called with Swapped Values
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: 'Reversal: REF-001',
        lines: {
          create: expect.arrayContaining([
            expect.objectContaining({
              accountId: 'acc-1',
              debit: 0,
              credit: 100,
            }), // Was Dr 100 -> Cr 100
            expect.objectContaining({
              accountId: 'acc-2',
              debit: 100,
              credit: 0,
            }), // Was Cr 100 -> Dr 100
          ]),
        },
      })
    );

    expect(result.id).toBe('je-2');
  });

  it('should fail if journal not found', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(
      service.reverse(companyId, journalId)
    ).rejects.toThrow('Journal entry not found');
  });
});
