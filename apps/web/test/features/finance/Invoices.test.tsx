import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import Invoices from '../../../src/features/finance/pages/Invoices';
import * as CompanyContext from '../../../src/contexts/CompanyContext';
import * as useCompanyDataHook from '../../../src/hooks/useCompanyData';
import { ConfirmProvider } from '../../../src/components/ui/ConfirmModal';

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

vi.mock('../../../src/services/invoiceService', () => ({
  invoiceService: {
    list: vi.fn(),
    post: vi.fn(),
    void: vi.fn(),
  },
  paymentService: {
    create: vi.fn(),
  },
}));

describe('Invoices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMocks = (options: {
    currentCompany?: ReturnType<
      typeof CompanyContext.useCompany
    >['currentCompany'];
    loading?: boolean;
    invoices?: unknown[];
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
      data: options.invoices ?? [],
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
          <Invoices />
        </ConfirmProvider>
      </MemoryRouter>
    );
  };

  describe('Loading State', () => {
    it('shows loading spinner when data is loading', () => {
      setupMocks({ loading: true });
      renderComponent();
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('Rendering', () => {
    it('renders invoices heading', () => {
      setupMocks({});
      renderComponent();
      expect(
        screen.getByRole('heading', { name: /invoices/i })
      ).toBeInTheDocument();
    });

    it('shows empty message when no invoices', () => {
      setupMocks({ invoices: [] });
      renderComponent();
      expect(
        screen.getByText(/no invoices found/i)
      ).toBeInTheDocument();
    });
  });

  describe('Invoice List', () => {
    it('displays invoice data', () => {
      setupMocks({
        invoices: [
          {
            id: '1',
            invoiceNumber: 'INV-001',
            date: new Date().toISOString(),
            status: 'DRAFT',
            totalAmount: 1500,
            balanceDue: 1500,
            partner: { name: 'Customer A' },
          },
        ],
      });
      renderComponent();

      expect(screen.getByText('INV-001')).toBeInTheDocument();
      expect(screen.getByText('Customer A')).toBeInTheDocument();
      const statusBadges = screen.getAllByText('DRAFT');
      expect(statusBadges.length).toBeGreaterThan(0);
      expect(statusBadges[0]).toBeInTheDocument();
    });
  });
});
