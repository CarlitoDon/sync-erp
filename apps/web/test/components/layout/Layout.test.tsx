import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { SidebarProvider } from '@/contexts/SidebarContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { CompanyProvider } from '@/contexts/CompanyContext';
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

const renderWithProviders = (initialRoute = '/') => {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <AuthProvider>
        <CompanyProvider>
          <SidebarProvider>
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
                      <div data-testid="outlet-content">
                        Test Content
                      </div>
                    }
                  />
                </Route>
              </Routes>
            </ConfirmProvider>
          </SidebarProvider>
        </CompanyProvider>
      </AuthProvider>
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
