import { render, screen } from '@testing-library/react';
import Dashboard from '../../../src/features/dashboard/pages/Dashboard';
import * as CompanyContext from '../../../src/contexts/CompanyContext';

vi.mock('../../../src/contexts/CompanyContext', async () => {
  const actual = await vi.importActual(
    '../../../src/contexts/CompanyContext'
  );
  return {
    ...actual,
    useCompany: vi.fn(),
  };
});

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
  };

  describe('Welcome Section', () => {
    it('renders welcome heading', () => {
      setupMock(null);
      render(<Dashboard />);

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
      render(<Dashboard />);

      expect(
        screen.getByText(/managing acme corp/i)
      ).toBeInTheDocument();
    });

    it('shows prompt to select company when none selected', () => {
      setupMock(null);
      render(<Dashboard />);

      expect(
        screen.getByText(/select a company to get started/i)
      ).toBeInTheDocument();
    });
  });

  describe('Stat Cards', () => {
    it('renders Sales Orders card', () => {
      setupMock(null);
      render(<Dashboard />);

      expect(screen.getByText('Sales Orders')).toBeInTheDocument();
    });

    it('renders Purchase Orders card', () => {
      setupMock(null);
      render(<Dashboard />);

      expect(screen.getByText('Purchase Orders')).toBeInTheDocument();
    });

    it('renders Invoices card', () => {
      setupMock(null);
      render(<Dashboard />);

      expect(screen.getByText('Invoices')).toBeInTheDocument();
    });

    it('renders Bills To Pay card', () => {
      setupMock(null);
      render(<Dashboard />);

      expect(screen.getByText('Bills To Pay')).toBeInTheDocument();
    });

    it('renders Products card', () => {
      setupMock(null);
      render(<Dashboard />);

      expect(screen.getByText('Products')).toBeInTheDocument();
    });
  });

  describe('Info Cards', () => {
    it('renders Getting Started section', () => {
      setupMock(null);
      render(<Dashboard />);

      expect(screen.getByText('Getting Started')).toBeInTheDocument();
    });

    it('renders Recent Activity section', () => {
      setupMock(null);
      render(<Dashboard />);

      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });

    it('shows no recent activity message', () => {
      setupMock(null);
      render(<Dashboard />);

      expect(
        screen.getByText('No recent activity')
      ).toBeInTheDocument();
    });

    it('renders getting started items', () => {
      setupMock(null);
      render(<Dashboard />);

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
