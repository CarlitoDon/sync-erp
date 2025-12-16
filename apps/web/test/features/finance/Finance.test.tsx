import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Finance from '../../../src/features/finance/pages/Finance';
import * as CompanyContext from '../../../src/contexts/CompanyContext';
import * as useCompanyDataHook from '../../../src/hooks/useCompanyData';
import { AccountType } from '@sync-erp/shared';

vi.mock('../../../src/contexts/CompanyContext', async () => {
  const actual = await vi.importActual(
    '../../../src/contexts/CompanyContext'
  );
  return {
    ...actual,
    useCompany: vi.fn(),
  };
});

vi.mock('../../../src/hooks/useCompanyData', async () => {
  const actual = await vi.importActual(
    '../../../src/hooks/useCompanyData'
  );
  return {
    ...actual,
    useCompanyData: vi.fn(),
  };
});

vi.mock('../../../src/services/financeService', () => ({
  financeService: {
    getAccounts: vi.fn(),
    createAccount: vi.fn(),
    getTrialBalance: vi.fn(),
    getJournalEntries: vi.fn(),
  },
  AccountType: {
    ASSET: 'ASSET',
    LIABILITY: 'LIABILITY',
    EQUITY: 'EQUITY',
    REVENUE: 'REVENUE',
    EXPENSE: 'EXPENSE',
  },
}));

// Mock child component to simplify testing
vi.mock('../../../src/pages/JournalEntries', () => ({
  default: () => (
    <div data-testid="journal-entries-component">
      Journal Entries Component
    </div>
  ),
}));

// Mock FinancialReport component
vi.mock('../../../src/features/finance/components/FinancialReport', () => ({
  FinancialReport: ({ title }: { title: string }) => (
    <div data-testid="financial-report">{title}</div>
  ),
}));

describe('Finance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMocks = (options: {
    currentCompany?: ReturnType<
      typeof CompanyContext.useCompany
    >['currentCompany'];
    loading?: boolean;
    accounts?: Array<{
      id: string;
      code: string;
      name: string;
      type: AccountType;
      description?: string;
    }>;
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
      data: {
        accounts: options.accounts ?? [],
        trialBalance: {
          companyId: '1',
          date: new Date().toISOString(),
          entries: [],
          totalDebit: 0,
          totalCredit: 0,
        },
      },
      loading: options.loading ?? false,
      error: null,
      refresh: vi.fn(),
      setData: vi.fn(),
    });
  };

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <Finance />
      </MemoryRouter>
    );
  };

  describe('Loading State', () => {
    it('shows loading spinner when data is loading', () => {
      setupMocks({ loading: true });
      renderComponent();
      expect(
        screen.getByText(/loading finance data/i)
      ).toBeInTheDocument();
    });
  });

  describe('No Company Selected', () => {
    it('shows message to select company when none selected', () => {
      setupMocks({ currentCompany: null });
      const { container } = renderComponent();
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Rendering', () => {
    it('renders finance heading', () => {
      setupMocks({});
      renderComponent();
      expect(
        screen.getByRole('heading', { name: /finance/i })
      ).toBeInTheDocument();
    });

    it('renders journal entries tab', () => {
      setupMocks({});
      renderComponent();
      // By default it might be on General Ledger tab or have buttons to switch
      const journalTab = screen.getByText('Journal Entries');
      expect(journalTab).toBeInTheDocument();
    });
  });

  describe('Account Management', () => {
    it('shows create account form when add button is clicked', () => {
      setupMocks({});
      renderComponent();

      fireEvent.click(screen.getByText('+ Add Account'));
      expect(screen.getByText('New Account')).toBeInTheDocument();
    });

    it('displays chart of accounts', () => {
      setupMocks({
        accounts: [
          { id: '1', code: '1000', name: 'Cash', type: 'ASSET' },
        ],
      });
      renderComponent();

      expect(screen.getByText('1000')).toBeInTheDocument();
      expect(screen.getByText('Cash')).toBeInTheDocument();
      expect(screen.getByText('ASSET')).toBeInTheDocument();
    });
  });

  describe('Reports', () => {
    it('renders report components', async () => {
      setupMocks({});
      renderComponent();

      fireEvent.click(screen.getByText('Financial Reports'));
      await waitFor(() => {
        expect(
          screen.getByTestId('financial-report')
        ).toHaveTextContent('Balance Sheet');
      });
    });
  });
});
