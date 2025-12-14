import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import JournalEntries from '../../../src/features/finance/pages/JournalEntries';
import * as CompanyContext from '../../../src/contexts/CompanyContext';
import * as useCompanyDataHook from '../../../src/hooks/useCompanyData';
import * as financeService from '../../../src/features/finance/services/financeService';

vi.mock('../../../src/hooks/useCompanyData', async () => {
  const actual = await vi.importActual(
    '../../../src/hooks/useCompanyData'
  );
  return {
    ...actual,
    useCompanyData: vi.fn(),
  };
});

vi.mock('../../../src/contexts/CompanyContext', async () => {
  const actual = await vi.importActual(
    '../../../src/contexts/CompanyContext'
  );
  return {
    ...actual,
    useCompany: vi.fn(),
  };
});

vi.mock(
  '../../../src/features/finance/services/financeService',
  () => ({
    financeService: {
      listJournals: vi.fn(),
      createJournal: vi.fn(),
      listAccounts: vi.fn(),
    },
  })
);

vi.mock('../../../src/hooks/useApiAction', () => ({
  useApiAction: (fn: () => Promise<void>) => ({
    execute: async () => {
      await fn();
    },
    loading: false,
    error: null,
  }),
  apiAction: vi.fn((fn) => fn()),
}));

describe('JournalEntries', () => {
  const mockCreateJournal = vi.fn();
  const mockListJournals = vi.fn();
  const mockListAccounts = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(
      financeService.financeService.createJournal
    ).mockImplementation(mockCreateJournal);
    vi.mocked(
      financeService.financeService.listJournals
    ).mockImplementation(mockListJournals);
    vi.mocked(
      financeService.financeService.listAccounts
    ).mockImplementation(mockListAccounts);

    mockListJournals.mockResolvedValue([]);
    mockListAccounts.mockResolvedValue([
      { id: '1', code: '1000', name: 'Cash' },
      { id: '2', code: '2000', name: 'Accounts Payable' },
    ]);
  });

  const setupMocks = (options: {
    currentCompany?: ReturnType<
      typeof CompanyContext.useCompany
    >['currentCompany'];
    loading?: boolean;
    journals?: unknown[];
  }) => {
    const currentCompany =
      options.currentCompany === undefined
        ? { id: '1', name: 'Test Co', createdAt: new Date() }
        : options.currentCompany;

    vi.mocked(CompanyContext.useCompany).mockReturnValue({
      currentCompany,
      companies: [],
      setCurrentCompany: vi.fn(),
      setCompanies: vi.fn(),
      refreshCompanies: vi.fn(),
      isLoading: false,
    });

    vi.mocked(useCompanyDataHook.useCompanyData).mockReturnValue({
      data: options.journals ?? [],
      loading: options.loading ?? false,
      error: null,
      refresh: vi.fn(),
      setData: vi.fn(),
    });
  };

  const renderComponent = () => {
    return render(<JournalEntries />);
  };

  describe('Rendering', () => {
    it('renders journal entries title', async () => {
      setupMocks({});
      renderComponent();
      expect(screen.getByText('Journal Entries')).toBeInTheDocument();
    });

    it('renders empty state when no entries', async () => {
      setupMocks({});
      renderComponent();
      // Need to wait for useEffect
      await waitFor(() => {
        expect(
          screen.getByText(/no journal entries found/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Create New Entry', () => {
    it('shows new entry form when button is clicked', async () => {
      setupMocks({});
      renderComponent();

      fireEvent.click(screen.getByText('New Entry'));
      expect(
        screen.getByRole('heading', { name: 'New Journal Entry' })
      ).toBeInTheDocument();
    });

    it('adds a new line when Add Line is clicked', async () => {
      setupMocks({});
      renderComponent();

      fireEvent.click(screen.getByText('New Entry'));
      const initialLines = screen.getAllByRole('combobox').length;

      fireEvent.click(screen.getByText('Add Line'));
      const newLines = screen.getAllByRole('combobox').length;

      expect(newLines).toBeGreaterThan(initialLines);
    });
  });
});
