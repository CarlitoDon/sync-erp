import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SalesOrders from '../../src/pages/SalesOrders';
import * as CompanyContext from '../../src/contexts/CompanyContext';
import * as useCompanyDataHook from '../../src/hooks/useCompanyData';
import { ConfirmProvider } from '../../src/components/ConfirmModal';

vi.mock('../../src/contexts/CompanyContext', async () => {
  const actual = await vi.importActual(
    '../../src/contexts/CompanyContext'
  );
  return {
    ...actual,
    useCompany: vi.fn(),
  };
});

vi.mock('../../src/hooks/useCompanyData', async () => {
  const actual = await vi.importActual(
    '../../src/hooks/useCompanyData'
  );
  return {
    ...actual,
    useCompanyData: vi.fn(),
  };
});

vi.mock('../../src/services/salesOrderService', () => ({
  salesOrderService: {
    list: vi.fn(),
    create: vi.fn(),
    confirm: vi.fn(),
    ship: vi.fn(),
    cancel: vi.fn(),
  },
}));

vi.mock('../../src/services/partnerService', () => ({
  partnerService: { listCustomers: vi.fn() },
}));

vi.mock('../../src/services/productService', () => ({
  productService: { list: vi.fn() },
}));

describe('SalesOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMocks = (options: {
    currentCompany?: ReturnType<
      typeof CompanyContext.useCompany
    >['currentCompany'];
    loading?: boolean;
    orders?: unknown[];
    customers?: unknown[];
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

    vi.mocked(useCompanyDataHook.useCompanyData).mockReturnValue({
      data: {
        orders: options.orders ?? [],
        customers: options.customers ?? [],
        products: options.products ?? [],
      },
      loading: options.loading ?? false,
      error: null,
      refresh: vi.fn(),
      setData: vi.fn(),
    });
  };

  const renderComponent = () => {
    return render(
      <ConfirmProvider>
        <SalesOrders />
      </ConfirmProvider>
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
    it('renders sales orders heading', () => {
      setupMocks({});
      renderComponent();
      expect(
        screen.getByRole('heading', { name: /sales orders/i })
      ).toBeInTheDocument();
    });

    it('renders create order button', () => {
      setupMocks({});
      renderComponent();
      expect(
        screen.getByRole('button', { name: /create so/i })
      ).toBeInTheDocument();
    });

    it('shows empty message when no orders', () => {
      setupMocks({ orders: [] });
      renderComponent();
      expect(
        screen.getByText(/no sales orders found/i)
      ).toBeInTheDocument();
    });
  });

  describe('Order List', () => {
    it('displays order data', () => {
      setupMocks({
        orders: [
          {
            id: '1',
            orderNumber: 'SO-001',
            date: new Date().toISOString(),
            status: 'DRAFT',
            totalAmount: 1000,
            partner: { name: 'Customer A' },
          },
        ],
      });
      renderComponent();

      expect(screen.getByText('SO-001')).toBeInTheDocument();
      expect(screen.getByText('Customer A')).toBeInTheDocument();
      expect(screen.getByText('DRAFT')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('shows create form when button is clicked', () => {
      setupMocks({});
      renderComponent();

      fireEvent.click(
        screen.getByRole('button', { name: /create so/i })
      );
      expect(
        screen.getByText(/new sales order/i)
      ).toBeInTheDocument();
    });
  });
});
