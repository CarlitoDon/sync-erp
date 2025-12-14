import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SidebarItem from '../../../src/components/layout/SidebarItem';
import * as SidebarContext from '../../../src/contexts/SidebarContext';

// Mock the SidebarContext
vi.mock('../../../src/contexts/SidebarContext', async () => {
  const actual = await vi.importActual(
    '../../../src/contexts/SidebarContext'
  );
  return {
    ...actual,
    useSidebar: vi.fn(),
  };
});

describe('SidebarItem', () => {
  const mockCloseMobile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMock = (
    overrides: Partial<
      ReturnType<typeof SidebarContext.useSidebar>
    > = {}
  ) => {
    vi.mocked(SidebarContext.useSidebar).mockReturnValue({
      isCollapsed: false,
      setIsCollapsed: vi.fn(),
      toggleCollapse: vi.fn(),
      isMobileOpen: false,
      setIsMobileOpen: vi.fn(),
      toggleMobileOpen: vi.fn(),
      closeMobile: mockCloseMobile,
      ...overrides,
    });
  };

  const renderComponent = (
    props: { path: string; label: string; icon: React.ReactNode },
    currentPath = '/'
  ) => {
    return render(
      <MemoryRouter initialEntries={[currentPath]}>
        <SidebarItem {...props} />
      </MemoryRouter>
    );
  };

  describe('Rendering', () => {
    it('renders a link with correct path', () => {
      setupMock();
      renderComponent({
        path: '/dashboard',
        label: 'Dashboard',
        icon: <span>🏠</span>,
      });

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/dashboard');
    });

    it('renders label when not collapsed', () => {
      setupMock({ isCollapsed: false });
      renderComponent({
        path: '/test',
        label: 'Test Label',
        icon: <span>📦</span>,
      });

      expect(screen.getByText('Test Label')).toBeInTheDocument();
    });

    it('hides label when collapsed', () => {
      setupMock({ isCollapsed: true });
      renderComponent({
        path: '/test',
        label: 'Test Label',
        icon: <span>📦</span>,
      });

      expect(
        screen.queryByText('Test Label')
      ).not.toBeInTheDocument();
    });

    it('renders icon', () => {
      setupMock();
      renderComponent({
        path: '/test',
        label: 'Test',
        icon: <span data-testid="test-icon">📦</span>,
      });

      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });

    it('shows title tooltip when collapsed', () => {
      setupMock({ isCollapsed: true });
      renderComponent({
        path: '/test',
        label: 'Test Label',
        icon: <span>📦</span>,
      });

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('title', 'Test Label');
    });

    it('does not show title tooltip when expanded', () => {
      setupMock({ isCollapsed: false });
      renderComponent({
        path: '/test',
        label: 'Test Label',
        icon: <span>📦</span>,
      });

      const link = screen.getByRole('link');
      expect(link).not.toHaveAttribute('title');
    });
  });

  describe('Active State', () => {
    it('applies active styles when path matches exactly for root', () => {
      setupMock();
      renderComponent(
        { path: '/', label: 'Home', icon: <span>🏠</span> },
        '/'
      );

      const link = screen.getByRole('link');
      expect(link).toHaveClass('bg-primary-100');
      expect(link).toHaveClass('text-primary-700');
    });

    it('applies active styles when path starts with item path', () => {
      setupMock();
      renderComponent(
        {
          path: '/products',
          label: 'Products',
          icon: <span>📦</span>,
        },
        '/products/123'
      );

      const link = screen.getByRole('link');
      expect(link).toHaveClass('bg-primary-100');
      expect(link).toHaveClass('text-primary-700');
    });

    it('applies inactive styles when path does not match', () => {
      setupMock();
      renderComponent(
        {
          path: '/products',
          label: 'Products',
          icon: <span>📦</span>,
        },
        '/customers'
      );

      const link = screen.getByRole('link');
      expect(link).toHaveClass('text-gray-600');
      expect(link).not.toHaveClass('bg-primary-100');
    });

    it('root is not active when on another path', () => {
      setupMock();
      renderComponent(
        { path: '/', label: 'Home', icon: <span>🏠</span> },
        '/products'
      );

      const link = screen.getByRole('link');
      expect(link).not.toHaveClass('bg-primary-100');
    });
  });

  describe('Click Behavior', () => {
    it('calls closeMobile when clicked', () => {
      setupMock();
      renderComponent({
        path: '/test',
        label: 'Test',
        icon: <span>📦</span>,
      });

      fireEvent.click(screen.getByRole('link'));

      expect(mockCloseMobile).toHaveBeenCalled();
    });
  });

  describe('Collapsed Layout', () => {
    it('centers content when collapsed', () => {
      setupMock({ isCollapsed: true });
      renderComponent({
        path: '/test',
        label: 'Test',
        icon: <span>📦</span>,
      });

      const link = screen.getByRole('link');
      expect(link).toHaveClass('justify-center');
    });
  });
});
