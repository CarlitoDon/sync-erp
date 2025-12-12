import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Customers from '../../src/pages/Customers';
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

// Mock partnerService
vi.mock('../../src/services/partnerService', () => ({
  partnerService: {
    listCustomers: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Customers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMocks = (options: {
    currentCompany?: ReturnType<
      typeof CompanyContext.useCompany
    >['currentCompany'];
    loading?: boolean;
    customers?: Array<{
      id: string;
      name: string;
      email: string;
      phone: string;
      address: string;
      type: 'CUSTOMER';
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
      data: options.customers ?? [],
      loading: options.loading ?? false,
      error: null,
      refresh: vi.fn(),
      setData: vi.fn(),
    });
  };

  const renderComponent = () => {
    return render(
      <ConfirmProvider>
        <Customers />
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
    it('renders customers heading', () => {
      setupMocks({});
      renderComponent();
      expect(
        screen.getByRole('heading', { name: /customers/i })
      ).toBeInTheDocument();
    });

    it('renders add customer button', () => {
      setupMocks({});
      renderComponent();
      expect(
        screen.getByRole('button', { name: /add customer/i })
      ).toBeInTheDocument();
    });

    it('shows empty message when no customers', () => {
      setupMocks({ customers: [] });
      renderComponent();
      expect(
        screen.getByText(/no customers found/i)
      ).toBeInTheDocument();
    });
  });

  describe('Customer Table', () => {
    it('displays customer data', () => {
      setupMocks({
        customers: [
          {
            id: '1',
            name: 'John Doe',
            email: 'john@example.com',
            phone: '555-0123',
            address: '123 Main St',
            type: 'CUSTOMER',
          },
        ],
      });
      renderComponent();

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(
        screen.getByText('john@example.com')
      ).toBeInTheDocument();
      expect(screen.getByText('555-0123')).toBeInTheDocument();
      expect(screen.getByText('123 Main St')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('shows create form when add button is clicked', () => {
      setupMocks({});
      renderComponent();

      fireEvent.click(
        screen.getByRole('button', { name: /add customer/i })
      );
      expect(screen.getByText(/new customer/i)).toBeInTheDocument();
    });
  });
});
