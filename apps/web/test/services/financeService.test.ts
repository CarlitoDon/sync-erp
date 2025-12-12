import { financeService } from '../../src/services/financeService';
import api from '../../src/services/api';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CreateJournalEntryInput } from '@sync-erp/shared';

vi.mock('../../src/services/api', async () => {
  const { mockApi } = await vi.importActual<any>('../mocks/services.mock');
  return { default: mockApi };
});

describe('financeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Accounts', () => {
    it('should list accounts', async () => {
      const mockData = [{ id: '1', name: 'Cash' }];
      (api.get as any).mockResolvedValue({ data: { data: mockData } });

      const result = await financeService.listAccounts();

      expect(api.get).toHaveBeenCalledWith('/finance/accounts', { params: {} });
      expect(result).toEqual(mockData);
    });

    it('should create account', async () => {
      const dto = { code: '101', name: 'Cash', type: 'ASSET' as const };
      const mockData = { id: '1', ...dto };
      (api.post as any).mockResolvedValue({ data: { data: mockData } });

      const result = await financeService.createAccount(dto);

      expect(api.post).toHaveBeenCalledWith('/finance/accounts', dto);
      expect(result).toEqual(mockData);
    });
  });

  describe('Journals', () => {
    it('should list journals with date range', async () => {
      const mockData = [{ id: '1' }];
      (api.get as any).mockResolvedValue({ data: { data: mockData } });

      const result = await financeService.listJournals('2023-01-01', '2023-01-31');

      expect(api.get).toHaveBeenCalledWith('/finance/journals', {
        params: { startDate: '2023-01-01', endDate: '2023-01-31' },
      });
      expect(result).toEqual(mockData);
    });

    it('should create journal', async () => {
      const dto: CreateJournalEntryInput = { date: '2023-01-01', lines: [] };
      const mockData = { id: '1' };
      (api.post as any).mockResolvedValue({ data: { data: mockData } });

      const result = await financeService.createJournal(dto);

      expect(api.post).toHaveBeenCalledWith('/finance/journals', dto);
      expect(result).toEqual(mockData);
    });
  });

  describe('Reports', () => {
    it('should get trial balance', async () => {
      const mockData = { totalDebit: 100, totalCredit: 100, isBalanced: true, entries: [] };
      (api.get as any).mockResolvedValue({ data: { data: mockData } });

      const result = await financeService.getTrialBalance('2023-01-01');

      expect(api.get).toHaveBeenCalledWith('/finance/reports/trial-balance', {
        params: { asOfDate: '2023-01-01' },
      });
      expect(result).toEqual(mockData);
    });
  });
});
