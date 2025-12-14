import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Products from '../../../src/features/inventory/pages/Products';
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

vi.mock(
  '../../../src/features/inventory/services/productService',
  () => ({
    productService: {
      list: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    Product: {},
    CreateProductInput: {},
  })
);

describe('Products', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMocks = (options: {
    currentCompany?: ReturnType<
      typeof CompanyContext.useCompany
    >['currentCompany'];
    loading?: boolean;
    products?: Array<{
      id: string;
      sku: string;
      name: string;
      price: number;
      averageCost: number;
      stockQty: number;
    }>;
  }) => {
    vi.mocked(CompanyContext.useCompany).mockReturnValue({
      currentCompany: options.currentCompany ?? {
        id: '1',
        name: 'Test Co',
        createdAt: new Date(),
      },
      companies: [],
      setCurrentCompany: vi.fn(),
      setCompanies: vi.fn(),
      refreshCompanies: vi.fn(),
      isLoading: false,
    });

    vi.mocked(useCompanyDataHook.useCompanyData).mockReturnValue({
      data: options.products ?? [],
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
          <Products />
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

  describe('Rendering Without Company', () => {
    it('renders products table even without current company', () => {
      setupMocks({ currentCompany: null });
      renderComponent();

      // The component should still render the table/empty state
      expect(
        screen.getByRole('heading', { name: /products/i })
      ).toBeInTheDocument();
    });
  });

  describe('Rendering', () => {
    it('renders products heading', () => {
      setupMocks({});
      renderComponent();

      expect(
        screen.getByRole('heading', { name: /products/i })
      ).toBeInTheDocument();
    });

    it('renders add product button', () => {
      setupMocks({});
      renderComponent();

      expect(
        screen.getByRole('button', { name: /add product/i })
      ).toBeInTheDocument();
    });

    it('shows empty message when no products', () => {
      setupMocks({ products: [] });
      renderComponent();

      expect(
        screen.getByText(/no products found/i)
      ).toBeInTheDocument();
    });
  });

  describe('Product Table', () => {
    it('displays product data', () => {
      setupMocks({
        products: [
          {
            id: '1',
            sku: 'SKU-001',
            name: 'Product A',
            price: 10000,
            averageCost: 8000,
            stockQty: 50,
          },
        ],
      });
      renderComponent();

      expect(screen.getByText('SKU-001')).toBeInTheDocument();
      expect(screen.getByText('Product A')).toBeInTheDocument();
    });

    it('shows correct stock badge colors', () => {
      setupMocks({
        products: [
          {
            id: '1',
            sku: 'SKU-001',
            name: 'Low Stock',
            price: 10000,
            averageCost: 8000,
            stockQty: 5,
          },
          {
            id: '2',
            sku: 'SKU-002',
            name: 'High Stock',
            price: 10000,
            averageCost: 8000,
            stockQty: 100,
          },
        ],
      });
      renderComponent();

      // Low stock should have yellow badge
      const lowStockBadge = screen.getByText('5');
      expect(lowStockBadge).toHaveClass('bg-yellow-100');

      // High stock should have green badge
      const highStockBadge = screen.getByText('100');
      expect(highStockBadge).toHaveClass('bg-green-100');
    });
  });
});
