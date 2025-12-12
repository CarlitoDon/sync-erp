import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../../src/components/ProtectedRoute';
import * as AuthContext from '../../src/contexts/AuthContext';
import * as CompanyContext from '../../src/contexts/CompanyContext';

// Mock the contexts
vi.mock('../../src/contexts/AuthContext', async () => {
  const actual = await vi.importActual(
    '../../src/contexts/AuthContext'
  );
  return {
    ...actual,
    useAuth: vi.fn(),
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

const renderWithRouter = (
  initialRoute = '/protected',
  requireCompany = true
) => {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route
          path="/login"
          element={<div data-testid="login-page">Login Page</div>}
        />
        <Route
          path="/select-company"
          element={
            <div data-testid="select-company">Select Company</div>
          }
        />
        <Route
          element={<ProtectedRoute requireCompany={requireCompany} />}
        >
          <Route
            path="/protected"
            element={
              <div data-testid="protected-content">
                Protected Content
              </div>
            }
          />
          <Route
            path="/no-company"
            element={
              <div data-testid="no-company-required">
                No Company Required
              </div>
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>
  );
};

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('shows loading when auth is loading', () => {
      vi.mocked(AuthContext.useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
        user: null,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });
      vi.mocked(CompanyContext.useCompany).mockReturnValue({
        currentCompany: null,
        companies: [],
        setCurrentCompany: vi.fn(),
        setCompanies: vi.fn(),
        refreshCompanies: vi.fn(),
        isLoading: false,
      });

      renderWithRouter();

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('shows loading when company is loading', () => {
      vi.mocked(AuthContext.useAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { id: '1', email: 'test@test.com', name: 'Test' },
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });
      vi.mocked(CompanyContext.useCompany).mockReturnValue({
        currentCompany: null,
        companies: [],
        setCurrentCompany: vi.fn(),
        setCompanies: vi.fn(),
        refreshCompanies: vi.fn(),
        isLoading: true,
      });

      renderWithRouter();

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Unauthenticated', () => {
    it('redirects to login when not authenticated', () => {
      vi.mocked(AuthContext.useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });
      vi.mocked(CompanyContext.useCompany).mockReturnValue({
        currentCompany: null,
        companies: [],
        setCurrentCompany: vi.fn(),
        setCompanies: vi.fn(),
        refreshCompanies: vi.fn(),
        isLoading: false,
      });

      renderWithRouter();

      expect(screen.getByTestId('login-page')).toBeInTheDocument();
      expect(
        screen.queryByTestId('protected-content')
      ).not.toBeInTheDocument();
    });
  });

  describe('Authenticated without Company', () => {
    it('redirects to select-company when requireCompany is true and no company selected', () => {
      vi.mocked(AuthContext.useAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { id: '1', email: 'test@test.com', name: 'Test' },
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });
      vi.mocked(CompanyContext.useCompany).mockReturnValue({
        currentCompany: null,
        companies: [],
        setCurrentCompany: vi.fn(),
        setCompanies: vi.fn(),
        refreshCompanies: vi.fn(),
        isLoading: false,
      });

      renderWithRouter('/protected', true);

      expect(
        screen.getByTestId('select-company')
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId('protected-content')
      ).not.toBeInTheDocument();
    });

    it('allows access when requireCompany is false and no company selected', () => {
      vi.mocked(AuthContext.useAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { id: '1', email: 'test@test.com', name: 'Test' },
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });
      vi.mocked(CompanyContext.useCompany).mockReturnValue({
        currentCompany: null,
        companies: [],
        setCurrentCompany: vi.fn(),
        setCompanies: vi.fn(),
        refreshCompanies: vi.fn(),
        isLoading: false,
      });

      renderWithRouter('/protected', false);

      expect(
        screen.getByTestId('protected-content')
      ).toBeInTheDocument();
    });
  });

  describe('Authenticated with Company', () => {
    it('renders outlet when authenticated with company selected', () => {
      vi.mocked(AuthContext.useAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { id: '1', email: 'test@test.com', name: 'Test' },
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
      });
      vi.mocked(CompanyContext.useCompany).mockReturnValue({
        currentCompany: {
          id: '1',
          name: 'Test Co',
          createdAt: new Date(),
        },
        companies: [
          { id: '1', name: 'Test Co', createdAt: new Date() },
        ],
        setCurrentCompany: vi.fn(),
        setCompanies: vi.fn(),
        refreshCompanies: vi.fn(),
        isLoading: false,
      });

      renderWithRouter();

      expect(
        screen.getByTestId('protected-content')
      ).toBeInTheDocument();
    });
  });
});
