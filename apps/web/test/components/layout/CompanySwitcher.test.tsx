import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CompanySwitcher from '@/components/layout/CompanySwitcher';
import * as CompanyContext from '@/contexts/CompanyContext';
import type { Company } from '@sync-erp/shared';

// Mock react-router-dom's useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock the CompanyContext
vi.mock('@/contexts/CompanyContext', async () => {
  const actual = await vi.importActual(
    '@/contexts/CompanyContext'
  );
  return {
    ...actual,
    useCompany: vi.fn(),
  };
});

const mockCompanies: Company[] = [
  { id: '1', name: 'Acme Corp', createdAt: new Date() },
  { id: '2', name: 'Beta Inc', createdAt: new Date() },
  { id: '3', name: 'Gamma LLC', createdAt: new Date() },
];

describe('CompanySwitcher', () => {
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
      companies: mockCompanies,
      currentCompany: mockCompanies[0],
      setCurrentCompany: mockSetCurrentCompany,
      setCompanies: vi.fn(),
      refreshCompanies: vi.fn(),
      isLoading: false,
      ...overrides,
    });
  };

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <CompanySwitcher />
      </MemoryRouter>
    );
  };

  describe('Loading State', () => {
    it('shows loading text when isLoading is true', () => {
      setupMock({ isLoading: true });
      renderComponent();

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows "No companies" when companies array is empty', () => {
      setupMock({ companies: [], isLoading: false });
      renderComponent();

      expect(screen.getByText('No companies')).toBeInTheDocument();
    });
  });

  describe('Normal State', () => {
    it('displays current company name', () => {
      setupMock();
      renderComponent();

      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    it('shows first letter of company name in avatar', () => {
      setupMock();
      renderComponent();

      expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('shows "Select Company" when no current company', () => {
      setupMock({ currentCompany: null });
      renderComponent();

      expect(screen.getByText('Select Company')).toBeInTheDocument();
    });

    it('opens dropdown when button is clicked', () => {
      setupMock();
      renderComponent();

      // Dropdown should be closed initially
      expect(screen.queryByText('Beta Inc')).not.toBeInTheDocument();

      // Click the button
      fireEvent.click(screen.getByRole('button'));

      // All companies should now be visible (Acme appears twice: button + dropdown)
      expect(
        screen.getAllByText('Acme Corp').length
      ).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('Beta Inc')).toBeInTheDocument();
      expect(screen.getByText('Gamma LLC')).toBeInTheDocument();
    });

    it('closes dropdown when clicking the same button again', () => {
      setupMock();
      renderComponent();

      const button = screen.getByRole('button');

      // Open
      fireEvent.click(button);
      expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(
        1
      ); // In button and dropdown

      // Close
      fireEvent.click(button);
      expect(screen.getAllByText('Acme Corp').length).toBe(1); // Only in button
    });
  });

  describe('Company Selection', () => {
    it('calls setCurrentCompany when a company is selected', async () => {
      setupMock();
      renderComponent();

      // Open dropdown
      fireEvent.click(screen.getByRole('button'));

      // Click on Beta Inc
      fireEvent.click(screen.getByText('Beta Inc'));

      expect(mockSetCurrentCompany).toHaveBeenCalledWith(
        mockCompanies[1]
      );
    });

    it('closes dropdown after selecting a company', () => {
      setupMock();
      renderComponent();

      // Open dropdown
      fireEvent.click(screen.getByRole('button'));

      // Companies should be visible
      expect(
        screen.getAllByText('Beta Inc').length
      ).toBeGreaterThanOrEqual(1);

      // Click on Beta Inc
      fireEvent.click(screen.getByText('Beta Inc'));

      // Dropdown should close - only the button text should remain
      expect(screen.queryAllByText('Gamma LLC').length).toBe(0);
    });
  });

  describe('Manage Companies Navigation', () => {
    it('navigates to /select-company when "Manage Companies..." is clicked', async () => {
      setupMock();
      renderComponent();

      // Open dropdown
      fireEvent.click(screen.getByRole('button'));

      // Click Manage Companies
      fireEvent.click(screen.getByText('Manage Companies...'));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/select-company');
      });
    });

    it('closes dropdown after clicking Manage Companies', () => {
      setupMock();
      renderComponent();

      // Open dropdown
      fireEvent.click(screen.getByRole('button'));

      // Click Manage Companies
      fireEvent.click(screen.getByText('Manage Companies...'));

      // Dropdown should close
      expect(screen.queryByText('Beta Inc')).not.toBeInTheDocument();
    });
  });
});
