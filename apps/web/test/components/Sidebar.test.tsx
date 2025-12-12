import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../../src/components/Sidebar';
import * as SidebarContext from '../../src/contexts/SidebarContext';
import * as CompanyContext from '../../src/contexts/CompanyContext';
import * as AuthContext from '../../src/contexts/AuthContext';

// Mock react-router-dom's useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock child components
vi.mock('../../src/components/SidebarNav', () => ({
  default: () => <nav data-testid="sidebar-nav">Navigation</nav>,
}));

vi.mock('../../src/components/CompanySwitcher', () => ({
  default: () => <div data-testid="company-switcher">Company Switcher</div>,
}));

// Mock the contexts
vi.mock('../../src/contexts/SidebarContext', async () => {
  const actual = await vi.importActual('../../src/contexts/SidebarContext');
  return {
    ...actual,
    useSidebar: vi.fn(),
  };
});

vi.mock('../../src/contexts/CompanyContext', async () => {
  const actual = await vi.importActual('../../src/contexts/CompanyContext');
  return {
    ...actual,
    useCompany: vi.fn(),
  };
});

vi.mock('../../src/contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../src/contexts/AuthContext');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

describe('Sidebar', () => {
  const mockLogout = vi.fn();
  const mockToggleCollapse = vi.fn();
  const mockCloseMobile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogout.mockResolvedValue(undefined);
  });

  const setupMocks = (
    overrides: {
      sidebar?: Partial<ReturnType<typeof SidebarContext.useSidebar>>;
      company?: Partial<ReturnType<typeof CompanyContext.useCompany>>;
      auth?: Partial<ReturnType<typeof AuthContext.useAuth>>;
    } = {}
  ) => {
    vi.mocked(SidebarContext.useSidebar).mockReturnValue({
      isCollapsed: false,
      setIsCollapsed: vi.fn(),
      toggleCollapse: mockToggleCollapse,
      isMobileOpen: false,
      setIsMobileOpen: vi.fn(),
      toggleMobileOpen: vi.fn(),
      closeMobile: mockCloseMobile,
      ...overrides.sidebar,
    });

    vi.mocked(CompanyContext.useCompany).mockReturnValue({
      currentCompany: {
        id: '1',
        name: 'Acme Corp',
        createdAt: new Date(),
      },
      companies: [],
      setCurrentCompany: vi.fn(),
      setCompanies: vi.fn(),
      refreshCompanies: vi.fn(),
      isLoading: false,
      ...overrides.company,
    });

    vi.mocked(AuthContext.useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: '1', email: 'test@test.com', name: 'John Doe' },
      login: vi.fn(),
      register: vi.fn(),
      logout: mockLogout,
      checkAuth: vi.fn(),
      ...overrides.auth,
    });
  };

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );
  };

  describe('Basic Rendering', () => {
    it('renders the sidebar', () => {
      setupMocks();
      renderComponent();

      expect(screen.getByRole('complementary')).toBeInTheDocument();
    });

    it('renders the logo', () => {
      setupMocks();
      renderComponent();

      expect(screen.getByText('S')).toBeInTheDocument();
      expect(screen.getByText('Sync ERP')).toBeInTheDocument();
    });

    it('renders the navigation', () => {
      setupMocks();
      renderComponent();

      expect(screen.getByTestId('sidebar-nav')).toBeInTheDocument();
    });
  });

  describe('Expanded State', () => {
    it('shows company switcher when expanded', () => {
      setupMocks({ sidebar: { isCollapsed: false } });
      renderComponent();

      expect(screen.getByTestId('company-switcher')).toBeInTheDocument();
    });

    it('shows user name when expanded', () => {
      setupMocks({ sidebar: { isCollapsed: false } });
      renderComponent();

      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('shows current company name when expanded', () => {
      setupMocks({ sidebar: { isCollapsed: false } });
      renderComponent();

      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    it('shows logout text when expanded', () => {
      setupMocks({ sidebar: { isCollapsed: false } });
      renderComponent();

      expect(screen.getByText('Logout')).toBeInTheDocument();
    });

    it('shows collapse button when expanded', () => {
      setupMocks({ sidebar: { isCollapsed: false } });
      renderComponent();

      expect(screen.getByTitle('Collapse sidebar')).toBeInTheDocument();
    });
  });

  describe('Collapsed State', () => {
    it('hides company switcher when collapsed', () => {
      setupMocks({ sidebar: { isCollapsed: true } });
      renderComponent();

      expect(screen.queryByTestId('company-switcher')).not.toBeInTheDocument();
    });

    it('hides user name when collapsed', () => {
      setupMocks({ sidebar: { isCollapsed: true } });
      renderComponent();

      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });

    it('hides logout text when collapsed but shows icon', () => {
      setupMocks({ sidebar: { isCollapsed: true } });
      renderComponent();

      expect(screen.queryByText('Logout')).not.toBeInTheDocument();
      // Logout button should still exist with title
      expect(screen.getByTitle('Logout')).toBeInTheDocument();
    });

    it('shows expand button when collapsed', () => {
      setupMocks({ sidebar: { isCollapsed: true } });
      renderComponent();

      expect(screen.getByTitle('Expand sidebar')).toBeInTheDocument();
    });
  });

  describe('Mobile Overlay', () => {
    it('shows overlay when mobile menu is open', () => {
      setupMocks({ sidebar: { isMobileOpen: true } });
      renderComponent();

      const overlay = document.querySelector('.bg-black\\/50');
      expect(overlay).toBeInTheDocument();
    });

    it('hides overlay when mobile menu is closed', () => {
      setupMocks({ sidebar: { isMobileOpen: false } });
      renderComponent();

      const overlay = document.querySelector('.bg-black\\/50');
      expect(overlay).not.toBeInTheDocument();
    });

    it('calls closeMobile when overlay is clicked', () => {
      setupMocks({ sidebar: { isMobileOpen: true } });
      renderComponent();

      const overlay = document.querySelector('.bg-black\\/50');
      fireEvent.click(overlay!);

      expect(mockCloseMobile).toHaveBeenCalled();
    });
  });

  describe('User Actions', () => {
    it('calls toggleCollapse when collapse button is clicked', () => {
      setupMocks({ sidebar: { isCollapsed: false } });
      renderComponent();

      fireEvent.click(screen.getByTitle('Collapse sidebar'));

      expect(mockToggleCollapse).toHaveBeenCalled();
    });

    it('calls toggleCollapse when expand button is clicked', () => {
      setupMocks({ sidebar: { isCollapsed: true } });
      renderComponent();

      fireEvent.click(screen.getByTitle('Expand sidebar'));

      expect(mockToggleCollapse).toHaveBeenCalled();
    });

    it('calls logout and navigates to /login when logout is clicked', async () => {
      setupMocks({ sidebar: { isCollapsed: false } });
      renderComponent();

      fireEvent.click(screen.getByText('Logout'));

      expect(mockLogout).toHaveBeenCalled();
    });
  });
});
