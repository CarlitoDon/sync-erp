import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CreateCompany from '../../../src/features/company/pages/CreateCompany';
import * as CompanyContext from '../../../src/contexts/CompanyContext';
import * as companyService from '../../../src/features/company/services/companyService';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../../src/contexts/CompanyContext', async () => {
  const actual = await vi.importActual(
    '../../../src/contexts/CompanyContext'
  );
  return {
    ...actual,
    useCompany: vi.fn(),
  };
});

vi.mock('../../../src/features/company/services/companyService', () => ({
  createCompany: vi.fn(),
  getCompanies: vi.fn(),
  joinCompany: vi.fn(),
}));

describe('CreateCompany', () => {
  const mockSetCompanies = vi.fn();
  const mockSetCurrentCompany = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(CompanyContext.useCompany).mockReturnValue({
      currentCompany: null,
      companies: [],
      setCurrentCompany: mockSetCurrentCompany,
      setCompanies: mockSetCompanies,
      refreshCompanies: vi.fn(),
      isLoading: false,
    });
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <CreateCompany />
      </MemoryRouter>
    );
  };

  describe('Rendering', () => {
    it('renders create company heading', () => {
      renderComponent();

      expect(
        screen.getByRole('heading', { name: /create company/i })
      ).toBeInTheDocument();
    });

    it('renders company name input', () => {
      renderComponent();

      expect(
        screen.getByLabelText(/company name/i)
      ).toBeInTheDocument();
    });

    it('renders cancel button', () => {
      renderComponent();

      expect(
        screen.getByRole('button', { name: /cancel/i })
      ).toBeInTheDocument();
    });

    it('renders create company submit button', () => {
      renderComponent();

      expect(
        screen.getByRole('button', { name: /create company/i })
      ).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('creates company on valid submit', async () => {
      const newCompany = {
        id: '1',
        name: 'New Corp',
        createdAt: new Date(),
      };
      vi.mocked(companyService.createCompany).mockResolvedValueOnce(
        newCompany
      );

      renderComponent();

      fireEvent.change(screen.getByLabelText(/company name/i), {
        target: { value: 'New Corp' },
      });
      fireEvent.click(
        screen.getByRole('button', { name: /create company/i })
      );

      await waitFor(() => {
        expect(companyService.createCompany).toHaveBeenCalledWith({
          name: 'New Corp',
        });
        expect(mockSetCurrentCompany).toHaveBeenCalledWith(
          newCompany
        );
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });

    it('shows loading state during submission', async () => {
      vi.mocked(companyService.createCompany).mockImplementation(
        () => new Promise(() => {})
      );
      renderComponent();

      fireEvent.change(screen.getByLabelText(/company name/i), {
        target: { value: 'New Corp' },
      });
      fireEvent.click(
        screen.getByRole('button', { name: /create company/i })
      );

      await waitFor(() => {
        expect(screen.getByText(/creating/i)).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('navigates to /companies when cancel is clicked', () => {
      renderComponent();

      fireEvent.click(
        screen.getByRole('button', { name: /cancel/i })
      );

      expect(mockNavigate).toHaveBeenCalledWith('/companies');
    });
  });
});
