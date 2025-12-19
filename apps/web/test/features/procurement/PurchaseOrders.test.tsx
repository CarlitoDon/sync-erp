import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import PurchaseOrders from '@/features/procurement/pages/PurchaseOrders';
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

vi.mock(
  '@/features/procurement/services/purchaseOrderService',
  () => ({
    purchaseOrderService: {
      list: vi.fn(),
      create: vi.fn(),
      confirm: vi.fn(),
      receive: vi.fn(),
      cancel: vi.fn(),
    },
  })
);

vi.mock('@/services/partnerService', () => ({
  partnerService: { listSuppliers: vi.fn() },
}));

vi.mock('@/services/productService', () => ({
  productService: { list: vi.fn() },
}));

describe('PurchaseOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMocks = (options: {
    currentCompany?: ReturnType<
      typeof CompanyContext.useCompany
    >['currentCompany'];
    loading?: boolean;
    orders?: unknown[];
    suppliers?: unknown[];
    products?: unknown[];
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

    // Mock useCompanyData to return different values based on initialData type
    // If initialData is array -> List component call (returns orders array)
    // If initialData is object -> Page component call (returns {suppliers, products})
    vi.mocked(useCompanyDataHook.useCompanyData).mockImplementation(
      (_fetcher, initialData) => {
        if (Array.isArray(initialData)) {
          // Component level hook - returns orders array directly
          return {
            data: options.orders ?? [],
            loading: options.loading ?? false,
            error: null,
            refresh: vi.fn(),
            setData: vi.fn(),
          };
        } else {
          // Page level hook - returns object with suppliers and products
          return {
            data: {
              suppliers: options.suppliers ?? [],
              products: options.products ?? [],
            },
            loading: options.loading ?? false,
            error: null,
            refresh: vi.fn(),
            setData: vi.fn(),
          };
        }
      }
    );
  };

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <ConfirmProvider>
          <PurchaseOrders />
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
    it('renders purchase orders heading', () => {
      setupMocks({});
      renderComponent();
      expect(
        screen.getByRole('heading', { name: /purchase orders/i })
      ).toBeInTheDocument();
    });

    it('renders create order button', () => {
      setupMocks({});
      renderComponent();
      expect(
        screen.getByRole('button', { name: /create po/i })
      ).toBeInTheDocument();
    });

    it('shows empty message when no orders', () => {
      setupMocks({ orders: [] });
      renderComponent();
      expect(
        screen.getByText(/no purchase orders found/i)
      ).toBeInTheDocument();
    });
  });

  describe('Order List', () => {
    it('displays order data', () => {
      setupMocks({
        orders: [
          {
            id: '1',
            orderNumber: 'PO-001',
            date: new Date().toISOString(),
            status: 'DRAFT',
            totalAmount: 5000,
            partner: { name: 'Supplier A' },
          },
        ],
      });
      renderComponent();

      expect(screen.getByText('PO-001')).toBeInTheDocument();
      expect(screen.getByText('Supplier A')).toBeInTheDocument();
      expect(screen.getByText('DRAFT')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('shows create form when button is clicked', () => {
      setupMocks({});
      renderComponent();

      fireEvent.click(
        screen.getByRole('button', { name: /create po/i })
      );
      expect(
        screen.getByText(/new purchase order/i)
      ).toBeInTheDocument();
    });
  });
});
