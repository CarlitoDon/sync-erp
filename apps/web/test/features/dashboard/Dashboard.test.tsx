import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import Dashboard from '../../../src/features/dashboard/pages/Dashboard';
import * as CompanyContext from '../../../src/contexts/CompanyContext';
import * as useCompanyDataHook from '../../../src/hooks/useCompanyData';

vi.mock('../../../src/contexts/CompanyContext', async () => {
  const actual = await vi.importActual(
    '../../../src/contexts/CompanyContext'
  );
  return {
    ...actual,
    useCompany: vi.fn(),
  };
});

vi.mock('../../../src/hooks/useCompanyData', () => ({
  useCompanyData: vi.fn(),
}));

vi.mock('../../../src/features/dashboard/hooks/useOnboardingProgress', () => ({
  useOnboardingProgress: vi.fn(() => ({
    loading: false,
    steps: [
      { id: '1', title: 'Create your first company', isCompleted: false },
      { id: '2', title: 'Add products and services', isCompleted: false },
      { id: '3', title: 'Set up customers and suppliers', isCompleted: false },
      { id: '4', title: 'Create your first order', isCompleted: false },
    ],
    completedCount: 0,
    totalCount: 4,
    isAllComplete: false,
    percentComplete: 0,
  })),
}));

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMock = (
    currentCompany: ReturnType<
      typeof CompanyContext.useCompany
    >['currentCompany']
  ) => {
    vi.mocked(CompanyContext.useCompany).mockReturnValue({
      currentCompany,
      companies: currentCompany ? [currentCompany] : [],
      setCurrentCompany: vi.fn(),
      setCompanies: vi.fn(),
      refreshCompanies: vi.fn(),
      isLoading: false,
    });

    // Mock useCompanyData to return metrics
    vi.mocked(useCompanyDataHook.useCompanyData).mockReturnValue({
      data: {
        totalReceivables: 0,
        totalPayables: 0,
        unpaidInvoices: 0,
        unpaidBills: 0,
        pendingOrders: 0,
        productsCount: 0,
        recentTransactions: [],
      },
      loading: false,
      error: null,
      refresh: vi.fn(),
      setData: vi.fn(),
    });
  };

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
  };

  describe('Welcome Section', () => {
    it('renders welcome heading', () => {
      setupMock(null);
      renderComponent();

      expect(
        screen.getByRole('heading', { name: /welcome to sync erp/i })
      ).toBeInTheDocument();
    });

    it('shows company name when company is selected', () => {
      setupMock({
        id: '1',
        name: 'Acme Corp',
        createdAt: new Date(),
      });
      renderComponent();

      expect(
        screen.getByText(/managing acme corp/i)
      ).toBeInTheDocument();
    });

    it('shows prompt to select company when none selected', () => {
      setupMock(null);
      renderComponent();

      expect(
        screen.getByText(/select a company to get started/i)
      ).toBeInTheDocument();
    });
  });

  describe('Stat Cards', () => {
    it('renders Accounts Receivable card', () => {
      setupMock(null);
      renderComponent();

      expect(screen.getByText('Accounts Receivable')).toBeInTheDocument();
    });

    it('renders Accounts Payable card', () => {
      setupMock(null);
      renderComponent();

      expect(screen.getByText('Accounts Payable')).toBeInTheDocument();
    });

    it('renders Unpaid Invoices card', () => {
      setupMock(null);
      renderComponent();

      expect(screen.getByText('Unpaid Invoices')).toBeInTheDocument();
    });

    it('renders Unpaid Bills card', () => {
      setupMock(null);
      renderComponent();

      expect(screen.getByText('Unpaid Bills')).toBeInTheDocument();
    });

    it('renders Pending Orders card', () => {
      setupMock(null);
      renderComponent();

      expect(screen.getByText('Pending Orders')).toBeInTheDocument();
    });

    it('renders Products card', () => {
      setupMock(null);
      renderComponent();

      expect(screen.getByText('Products')).toBeInTheDocument();
    });
  });

  describe('Info Cards', () => {
    it('renders Getting Started section', () => {
      setupMock(null);
      renderComponent();

      expect(screen.getByText('Getting Started')).toBeInTheDocument();
    });

    it('renders Recent Activity section', () => {
      setupMock(null);
      renderComponent();

      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });

    it('shows no recent activity message', () => {
      setupMock(null);
      renderComponent();

      expect(
        screen.getByText('No recent activity')
      ).toBeInTheDocument();
    });

    it('renders getting started items', () => {
      setupMock(null);
      renderComponent();

      expect(
        screen.getByText('Create your first company')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Add products and services')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Set up customers and suppliers')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Create your first order')
      ).toBeInTheDocument();
    });
  });
});
