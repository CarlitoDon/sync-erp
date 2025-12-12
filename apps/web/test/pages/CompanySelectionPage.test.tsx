import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CompanySelectionPage } from '../../src/pages/CompanySelectionPage';
import * as CompanyContext from '../../src/contexts/CompanyContext';
import * as AuthContext from '../../src/contexts/AuthContext';
import * as companyService from '../../src/services/companyService';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../src/contexts/CompanyContext', async () => {
  const actual = await vi.importActual(
    '../../src/contexts/CompanyContext'
  );
  return {
    ...actual,
    useCompany: vi.fn(),
  };
});

vi.mock('../../src/contexts/AuthContext', async () => {
  const actual = await vi.importActual(
    '../../src/contexts/AuthContext'
  );
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

vi.mock('../../src/services/companyService', () => ({
  createCompany: vi.fn(),
  joinCompany: vi.fn(),
  getCompanies: vi.fn(),
}));

describe('CompanySelectionPage', () => {
  const mockSetCurrentCompany = vi.fn();
  const mockRefreshCompanies = vi.fn();
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: '1', email: 'test@test.com', name: 'Test' },
      login: vi.fn(),
      register: vi.fn(),
      logout: mockLogout,
      checkAuth: vi.fn(),
    });
  });

  const setupCompanyMock = (
    overrides: Partial<
      ReturnType<typeof CompanyContext.useCompany>
    > = {}
  ) => {
    vi.mocked(CompanyContext.useCompany).mockReturnValue({
      currentCompany: null,
      companies: [],
      setCurrentCompany: mockSetCurrentCompany,
      setCompanies: vi.fn(),
      refreshCompanies: mockRefreshCompanies,
      isLoading: false,
      ...overrides,
    });
  };

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <CompanySelectionPage />
      </MemoryRouter>
    );
  };

  describe('Loading State', () => {
    it('shows loading message when company data is loading', () => {
      setupCompanyMock({ isLoading: true });
      renderComponent();

      expect(
        screen.getByText(/loading companies/i)
      ).toBeInTheDocument();
    });
  });

  describe('List View', () => {
    it('renders select a company heading', () => {
      setupCompanyMock();
      renderComponent();

      expect(
        screen.getByRole('heading', { name: /select a company/i })
      ).toBeInTheDocument();
    });

    it('shows no companies message when list is empty', () => {
      setupCompanyMock({ companies: [] });
      renderComponent();

      expect(
        screen.getByText(/not a member of any company/i)
      ).toBeInTheDocument();
    });

    it('displays company list when companies exist', () => {
      setupCompanyMock({
        companies: [
          { id: '1', name: 'Acme Corp', createdAt: new Date() },
          { id: '2', name: 'Beta Inc', createdAt: new Date() },
        ],
      });
      renderComponent();

      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      expect(screen.getByText('Beta Inc')).toBeInTheDocument();
    });

    it('calls setCurrentCompany and navigates when company is selected', async () => {
      const mockCompany = {
        id: '1',
        name: 'Acme Corp',
        createdAt: new Date(),
      };
      setupCompanyMock({ companies: [mockCompany] });
      renderComponent();

      fireEvent.click(screen.getByText('Acme Corp'));

      await waitFor(() => {
        expect(mockSetCurrentCompany).toHaveBeenCalledWith(
          mockCompany
        );
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });

    it('shows Create New Company button', () => {
      setupCompanyMock();
      renderComponent();

      expect(
        screen.getByRole('button', { name: /create new company/i })
      ).toBeInTheDocument();
    });

    it('shows Join Existing Company button', () => {
      setupCompanyMock();
      renderComponent();

      expect(
        screen.getByRole('button', { name: /join existing company/i })
      ).toBeInTheDocument();
    });
  });

  describe('Create Company View', () => {
    it('switches to create view when button is clicked', () => {
      setupCompanyMock();
      renderComponent();

      fireEvent.click(
        screen.getByRole('button', { name: /create new company/i })
      );

      expect(screen.getByText(/create company/i)).toBeInTheDocument();
      expect(
        screen.getByLabelText(/company name/i)
      ).toBeInTheDocument();
    });

    it('creates company on form submit', async () => {
      const newCompany = {
        id: '3',
        name: 'New Corp',
        createdAt: new Date(),
      };
      vi.mocked(companyService.createCompany).mockResolvedValueOnce(
        newCompany
      );
      mockRefreshCompanies.mockResolvedValueOnce(undefined);

      setupCompanyMock();
      renderComponent();

      fireEvent.click(
        screen.getByRole('button', { name: /create new company/i })
      );
      fireEvent.change(screen.getByLabelText(/company name/i), {
        target: { value: 'New Corp' },
      });
      fireEvent.click(
        screen.getByRole('button', { name: /^create$/i })
      );

      await waitFor(() => {
        expect(companyService.createCompany).toHaveBeenCalledWith({
          name: 'New Corp',
        });
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });

    it('shows cancel button that returns to list', () => {
      setupCompanyMock();
      renderComponent();

      fireEvent.click(
        screen.getByRole('button', { name: /create new company/i })
      );
      fireEvent.click(
        screen.getByRole('button', { name: /cancel/i })
      );

      expect(
        screen.queryByLabelText(/company name/i)
      ).not.toBeInTheDocument();
    });
  });

  describe('Join Company View', () => {
    it('switches to join view when button is clicked', () => {
      setupCompanyMock();
      renderComponent();

      fireEvent.click(
        screen.getByRole('button', { name: /join existing company/i })
      );

      expect(screen.getByText(/join company/i)).toBeInTheDocument();
      expect(
        screen.getByLabelText(/invite code/i)
      ).toBeInTheDocument();
    });

    it('joins company on form submit', async () => {
      const joinedCompany = {
        id: '4',
        name: 'Partner Corp',
        createdAt: new Date(),
      };
      vi.mocked(companyService.joinCompany).mockResolvedValueOnce(
        joinedCompany
      );
      mockRefreshCompanies.mockResolvedValueOnce(undefined);

      setupCompanyMock();
      renderComponent();

      fireEvent.click(
        screen.getByRole('button', { name: /join existing company/i })
      );
      fireEvent.change(screen.getByLabelText(/invite code/i), {
        target: { value: 'ABC123' },
      });
      fireEvent.click(
        screen.getByRole('button', { name: /^join$/i })
      );

      await waitFor(() => {
        expect(companyService.joinCompany).toHaveBeenCalledWith({
          inviteCode: 'ABC123',
        });
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });
  });

  describe('Logout', () => {
    it('calls logout and navigates to login when logout is clicked', async () => {
      mockLogout.mockResolvedValueOnce(undefined);
      setupCompanyMock();
      renderComponent();

      fireEvent.click(
        screen.getByRole('button', { name: /log out/i })
      );

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });
    });
  });
});
