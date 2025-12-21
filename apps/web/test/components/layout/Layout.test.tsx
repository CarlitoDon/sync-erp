import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import * as AuthContext from '@/contexts/AuthContext';
import * as CompanyContext from '@/contexts/CompanyContext';
import * as SidebarContext from '@/contexts/SidebarContext';
import { ConfirmProvider } from '@/components/ui/ConfirmModal';

// Mock child components to simplify testing
vi.mock('@/components/layout/Sidebar', () => ({
  default: () => <div data-testid="sidebar">Sidebar</div>,
}));

vi.mock('@/components/layout/MobileMenuButton', () => ({
  default: () => (
    <button data-testid="mobile-menu-button">Menu</button>
  ),
}));

// Mock the contexts
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: vi.fn(),
  CompanyProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock('@/contexts/SidebarContext', () => ({
  useSidebar: vi.fn(),
  SidebarProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

const renderWithProviders = (initialRoute = '/') => {
  // Setup default mock values
  vi.mocked(AuthContext.useAuth).mockReturnValue({
    isAuthenticated: true,
    user: {
      id: '1',
      name: 'Test User',
      email: 'test@example.com',
    } as any,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    checkAuth: vi.fn(),
  });

  vi.mocked(CompanyContext.useCompany).mockReturnValue({
    currentCompany: { id: '1', name: 'Test Co' } as any,
    companies: [],
    setCurrentCompany: vi.fn(),
    setCompanies: vi.fn(),
    refreshCompanies: vi.fn(),
    isLoading: false,
  });

  vi.mocked(SidebarContext.useSidebar).mockReturnValue({
    isCollapsed: false,
    setIsCollapsed: vi.fn(),
    toggleCollapse: vi.fn(),
    isMobileOpen: false,
    setIsMobileOpen: vi.fn(),
    toggleMobileOpen: vi.fn(),
    closeMobile: vi.fn(),
  });

  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <ConfirmProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route
              index
              element={
                <div data-testid="outlet-content">
                  Dashboard Content
                </div>
              }
            />
            <Route
              path="test"
              element={
                <div data-testid="outlet-content">Test Content</div>
              }
            />
          </Route>
        </Routes>
      </ConfirmProvider>
    </MemoryRouter>
  );
};

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Structure', () => {
    it('renders the sidebar', () => {
      renderWithProviders();

      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    });

    it('renders the mobile menu button', () => {
      renderWithProviders();

      expect(
        screen.getByTestId('mobile-menu-button')
      ).toBeInTheDocument();
    });

    it('renders the outlet content', () => {
      renderWithProviders();

      expect(
        screen.getByTestId('outlet-content')
      ).toBeInTheDocument();
    });
  });

  describe('Header', () => {
    it('renders mobile header with logo link', () => {
      renderWithProviders();

      // Find the logo link - should have 'Sync ERP' text
      expect(screen.getByText('Sync ERP')).toBeInTheDocument();
    });

    it('renders logo with S initial', () => {
      renderWithProviders();

      expect(screen.getByText('S')).toBeInTheDocument();
    });
  });

  describe('Footer', () => {
    it('renders copyright text', () => {
      renderWithProviders();

      expect(screen.getByText(/© 2024 Sync ERP/)).toBeInTheDocument();
    });

    it('renders ERP description', () => {
      renderWithProviders();

      expect(
        screen.getByText(/Multi-Company Enterprise Resource Planning/)
      ).toBeInTheDocument();
    });
  });

  describe('Outlet Integration', () => {
    it('renders index route content', () => {
      renderWithProviders('/');

      expect(
        screen.getByText('Dashboard Content')
      ).toBeInTheDocument();
    });

    it('renders nested route content', () => {
      renderWithProviders('/test');

      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });
  });
});
