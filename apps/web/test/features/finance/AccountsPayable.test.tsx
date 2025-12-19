import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import AccountsPayable from '@/features/finance/pages/AccountsPayable';
import * as CompanyContext from '@/contexts/CompanyContext';
import * as useCompanyDataHook from '@/hooks/useCompanyData';
import { ConfirmProvider } from '@/components/ui/ConfirmModal';

vi.mock('@/contexts/CompanyContext', async () => {
  const actual = await vi.importActual('@/contexts/CompanyContext');
  return {
    ...actual,
    useCompany: vi.fn(),
  };
});

vi.mock('@/hooks/useCompanyData', async () => {
  const actual = await vi.importActual('@/hooks/useCompanyData');
  return {
    ...actual,
    useCompanyData: vi.fn(),
  };
});

vi.mock('@/services/billService', () => ({
  billService: {
    list: vi.fn(),
    post: vi.fn(),
    void: vi.fn(),
  },
}));

vi.mock('@/services/invoiceService', () => ({
  paymentService: {
    create: vi.fn(),
  },
}));

describe('AccountsPayable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMocks = (options: {
    currentCompany?: ReturnType<
      typeof CompanyContext.useCompany
    >['currentCompany'];
    loading?: boolean;
    bills?: unknown[];
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
      data: options.bills ?? [],
      loading: options.loading ?? false,
      error: null,
      refresh: vi.fn(),
      setData: vi.fn(),
    });
  };

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <ConfirmProvider>
          <AccountsPayable />
        </ConfirmProvider>
      </MemoryRouter>
    );
  };

  describe('Loading State', () => {
    it('shows loading spinner when data is loading', () => {
      setupMocks({ loading: true });
      renderComponent();
      expect(
        document.querySelector('.animate-spin')
      ).toBeInTheDocument();
    });
  });

  describe('Rendering', () => {
    it('renders heading', () => {
      setupMocks({});
      renderComponent();
      expect(
        screen.getByRole('heading', { name: /bills/i })
      ).toBeInTheDocument();
    });

    it('shows empty message when no bills', () => {
      setupMocks({ bills: [] });
      renderComponent();
      expect(screen.getByText(/no bills found/i)).toBeInTheDocument();
    });
  });

  describe('Bill List', () => {
    it('displays bill data', () => {
      setupMocks({
        bills: [
          {
            id: '1',
            invoiceNumber: 'BILL-001',
            date: new Date().toISOString(),
            status: 'DRAFT',
            totalAmount: 2000,
            balanceDue: 2000,
            partner: { name: 'Supplier B' },
          },
        ],
      });
      renderComponent();

      expect(screen.getByText('BILL-001')).toBeInTheDocument();
      expect(screen.getByText('Supplier B')).toBeInTheDocument();
      expect(
        screen.getByRole('cell', { name: /draft/i })
      ).toBeInTheDocument();
    });
  });
});
