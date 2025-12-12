import { renderHook, waitFor } from '@testing-library/react';
import { useCompanyData } from '../../src/hooks/useCompanyData';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Company } from '@sync-erp/shared';

import { mockUseCompany } from '../mocks/hooks.mock';

vi.mock('../../src/contexts/CompanyContext', async () => {
  const { mockUseCompany } = await vi.importActual<any>(
    '../mocks/hooks.mock'
  );
  return {
    useCompany: mockUseCompany,
  };
});

describe('useCompanyData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not fetch data if no current company', async () => {
    mockUseCompany.mockReturnValue({
      currentCompany: null,
      companies: [],
      setCurrentCompany: vi.fn(),
      setCompanies: vi.fn(),
      refreshCompanies: vi.fn(),
      isLoading: false,
    });
    const fetcher = vi.fn();

    const { result } = renderHook(() =>
      useCompanyData(fetcher, 'initial')
    );

    expect(result.current.data).toBe('initial');
    expect(result.current.loading).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('should fetch data when company is present', async () => {
    const mockCompany = { id: '123' } as Company;
    mockUseCompany.mockReturnValue({
      currentCompany: mockCompany,
      companies: [],
      setCurrentCompany: vi.fn(),
      setCompanies: vi.fn(),
      refreshCompanies: vi.fn(),
      isLoading: false,
    });
    const fetcher = vi.fn().mockResolvedValue('fetched data');

    const { result } = renderHook(() =>
      useCompanyData(fetcher, 'initial')
    );

    // Initially loading
    expect(result.current.loading).toBe(true);

    // Wait for update
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetcher).toHaveBeenCalled();
    expect(result.current.data).toBe('fetched data');
  });

  it('should handle errors', async () => {
    const mockCompany = { id: '123' } as Company;
    mockUseCompany.mockReturnValue({
      currentCompany: mockCompany,
      companies: [],
      setCurrentCompany: vi.fn(),
      setCompanies: vi.fn(),
      refreshCompanies: vi.fn(),
      isLoading: false,
    });
    const fetcher = vi
      .fn()
      .mockRejectedValue(new Error('Fetch failed'));

    const { result } = renderHook(() =>
      useCompanyData(fetcher, 'initial')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe('Fetch failed');
  });
});
