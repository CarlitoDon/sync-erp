import { render, screen } from '@testing-library/react';
import Inventory from '../../../src/features/inventory/pages/Inventory';
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

vi.mock('../../../src/hooks/useCompanyData', async () => {
  const actual = await vi.importActual(
    '../../../src/hooks/useCompanyData'
  );
  return {
    ...actual,
    useCompanyData: vi.fn(),
  };
});

vi.mock('../../../src/features/inventory/services/productService', () => ({
  productService: {
    getStockLevels: vi.fn(),
  },
}));

describe('Inventory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMocks = (options: {
    currentCompany?: ReturnType<
      typeof CompanyContext.useCompany
    >['currentCompany'];
    loading?: boolean;
    stockLevels?: Array<{
      id: string;
      sku: string;
      name: string;
      stockQty: number;
      averageCost: number;
      price: number;
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
      data: options.stockLevels ?? [],
      loading: options.loading ?? false,
      error: null,
      refresh: vi.fn(),
      setData: vi.fn(),
    });
  };

  const renderComponent = () => {
    return render(<Inventory />);
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
    it('renders inventory heading', () => {
      setupMocks({});
      renderComponent();
      expect(
        screen.getByRole('heading', { name: /inventory/i })
      ).toBeInTheDocument();
    });

    it('renders refresh button', () => {
      setupMocks({});
      renderComponent();
      expect(screen.getByText(/refresh/i)).toBeInTheDocument();
    });

    it('shows empty message when no inventory', () => {
      setupMocks({ stockLevels: [] });
      renderComponent();
      expect(
        screen.getByText(/no products in inventory/i)
      ).toBeInTheDocument();
    });
  });

  describe('Summary Cards', () => {
    it('displays summary statistics', () => {
      setupMocks({
        stockLevels: [
          {
            id: '1',
            sku: 'A',
            name: 'Product A',
            stockQty: 10,
            averageCost: 100,
            price: 200,
          },
          {
            id: '2',
            sku: 'B',
            name: 'Product B',
            stockQty: 5,
            averageCost: 50,
            price: 100,
          },
        ],
      });
      renderComponent();

      // Total Products: 2
      expect(screen.getByText('2')).toBeInTheDocument();
      // Total Units: 15
      expect(screen.getByText('15')).toBeInTheDocument();
    });
  });

  describe('Alerts', () => {
    it('shows low stock warning', () => {
      setupMocks({
        stockLevels: [
          {
            id: '1',
            sku: 'A',
            name: 'Low Stock Product',
            stockQty: 5,
            averageCost: 100,
            price: 200,
          },
        ],
      });
      renderComponent();

      expect(
        screen.getByRole('heading', { name: /low stock warning/i })
      ).toBeInTheDocument();
    });

    it('shows out of stock alert', () => {
      setupMocks({
        stockLevels: [
          {
            id: '1',
            sku: 'A',
            name: 'Out of Stock Product',
            stockQty: 0,
            averageCost: 100,
            price: 200,
          },
        ],
      });
      renderComponent();

      expect(
        screen.getByRole('heading', { name: /out of stock/i })
      ).toBeInTheDocument();
    });
  });
});
