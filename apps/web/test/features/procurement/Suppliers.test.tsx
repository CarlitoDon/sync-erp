import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import Suppliers from '@/features/procurement/pages/Suppliers';
import * as CompanyContext from '@/contexts/CompanyContext';
import * as useCompanyDataHook from '@/hooks/useCompanyData';
import { ConfirmProvider } from '@/components/ui/ConfirmModal';

vi.mock('@/contexts/CompanyContext', async () => {
  const actual = await vi.importActual(
    '@/contexts/CompanyContext'
  );
  return {
    ...actual,
    useCompany: vi.fn(),
  };
});

vi.mock('@/hooks/useCompanyData', async () => {
  const actual = await vi.importActual(
    '@/hooks/useCompanyData'
  );
  return {
    ...actual,
    useCompanyData: vi.fn(),
  };
});

// Mock partnerService
vi.mock('@/services/partnerService', () => ({
  partnerService: {
    listSuppliers: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Suppliers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMocks = (options: {
    currentCompany?: ReturnType<
      typeof CompanyContext.useCompany
    >['currentCompany'];
    loading?: boolean;
    suppliers?: Array<{
      id: string;
      name: string;
      email: string;
      phone: string;
      address: string;
      type: 'SUPPLIER';
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
      data: options.suppliers ?? [],
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
          <Suppliers />
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

  describe('No Company Selected', () => {
    it('shows message to select company when none selected', () => {
      setupMocks({ currentCompany: null });
      renderComponent();
      expect(
        screen.getByText(/please select a company/i)
      ).toBeInTheDocument();
    });
  });

  describe('Rendering', () => {
    it('renders suppliers heading', () => {
      setupMocks({});
      renderComponent();
      expect(
        screen.getByRole('heading', { name: /suppliers/i })
      ).toBeInTheDocument();
    });

    it('renders add supplier button', () => {
      setupMocks({});
      renderComponent();
      expect(
        screen.getByRole('button', { name: /add supplier/i })
      ).toBeInTheDocument();
    });

    it('shows empty message when no suppliers', () => {
      setupMocks({ suppliers: [] });
      renderComponent();
      expect(
        screen.getByText(/no suppliers found/i)
      ).toBeInTheDocument();
    });
  });

  describe('Supplier Table', () => {
    it('displays supplier data', () => {
      setupMocks({
        suppliers: [
          {
            id: '1',
            name: 'Acme Supplies',
            email: 'supply@acme.com',
            phone: '555-9876',
            address: '456 Supply Rd',
            type: 'SUPPLIER',
          },
        ],
      });
      renderComponent();

      expect(screen.getByText('Acme Supplies')).toBeInTheDocument();
      expect(screen.getByText('supply@acme.com')).toBeInTheDocument();
      expect(screen.getByText('555-9876')).toBeInTheDocument();
      expect(screen.getByText('456 Supply Rd')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('shows create form when add button is clicked', () => {
      setupMocks({});
      renderComponent();

      fireEvent.click(
        screen.getByRole('button', { name: /add supplier/i })
      );
      expect(screen.getByText(/new supplier/i)).toBeInTheDocument();
    });
  });
});
