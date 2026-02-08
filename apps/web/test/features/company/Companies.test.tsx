import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Companies from '@/features/company/pages/Companies';
import * as CompanyContext from '@/contexts/CompanyContext';
import { BusinessShape, type Company } from '@/types/api';

vi.mock('@/contexts/CompanyContext', async () => {
  const actual = await vi.importActual('@/contexts/CompanyContext');
  return {
    ...actual,
    useCompany: vi.fn(),
  };
});

describe('Companies', () => {
  const mockSetCurrentCompany = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMock = (
    overrides: Partial<
      ReturnType<typeof CompanyContext.useCompany>
    > = {}
  ) => {
    vi.mocked(CompanyContext.useCompany).mockReturnValue({
      currentCompany: null,
      companies: [],
      setCurrentCompany: mockSetCurrentCompany,
      refreshCompanies: vi.fn(),
      isLoading: false,
      ...overrides,
    });
  };

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <Companies />
      </MemoryRouter>
    );
  };

  describe('Rendering', () => {
    it('renders companies heading', () => {
      setupMock();
      renderComponent();

      // Multiple headings may contain "companies" text, just verify at least one exists
      const headings = screen.getAllByRole('heading', {
        name: /companies/i,
      });
      expect(headings.length).toBeGreaterThanOrEqual(1);
    });

    it('renders new company link', () => {
      setupMock();
      renderComponent();

      expect(
        screen.getByRole('link', { name: /new company/i })
      ).toBeInTheDocument();
    });

    it('shows empty state when no companies', () => {
      setupMock({ companies: [] });
      renderComponent();

      expect(
        screen.getByText(/no companies yet/i)
      ).toBeInTheDocument();
    });

    it('shows create company link in empty state', () => {
      setupMock({ companies: [] });
      renderComponent();

      const links = screen.getAllByRole('link', {
        name: /create company/i,
      });
      expect(links.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Company List', () => {
    it('displays company names', () => {
      setupMock({
        companies: [
          {
            id: '1',
            name: 'Acme Corp',
            createdAt: new Date(),
            updatedAt: new Date(),
            businessShape: BusinessShape.RETAIL,
            inviteCode: 'INV1',
          },
          {
            id: '2',
            name: 'Beta Inc',
            createdAt: new Date(),
            updatedAt: new Date(),
            businessShape: BusinessShape.SERVICE,
            inviteCode: 'INV2',
          },
        ],
      });
      renderComponent();

      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      expect(screen.getByText('Beta Inc')).toBeInTheDocument();
    });

    it('shows Active badge on current company', () => {
      const currentCompany: Company = {
        id: '1',
        name: 'Acme Corp',
        createdAt: new Date(),
        updatedAt: new Date(),
        businessShape: BusinessShape.RETAIL,
        inviteCode: 'INV1',
      };
      setupMock({
        currentCompany,
        companies: [
          currentCompany,
          {
            id: '2',
            name: 'Beta Inc',
            createdAt: new Date(),
            updatedAt: new Date(),
            businessShape: BusinessShape.SERVICE,
            inviteCode: 'INV2',
          },
        ],
      });
      renderComponent();

      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('calls setCurrentCompany when company card is clicked', () => {
      const company: Company = {
        id: '1',
        name: 'Acme Corp',
        createdAt: new Date(),
        updatedAt: new Date(),
        businessShape: BusinessShape.RETAIL,
        inviteCode: 'INV1',
      };
      setupMock({ companies: [company] });
      renderComponent();

      fireEvent.click(screen.getByText('Acme Corp'));

      expect(mockSetCurrentCompany).toHaveBeenCalledWith(company);
    });
  });
});
