import { render, screen, fireEvent } from '@testing-library/react';
import MobileMenuButton from '@/components/layout/MobileMenuButton';
import * as SidebarContext from '@/contexts/SidebarContext';

// Mock the SidebarContext
vi.mock('@/contexts/SidebarContext', async () => {
  const actual = await vi.importActual(
    '@/contexts/SidebarContext'
  );
  return {
    ...actual,
    useSidebar: vi.fn(),
  };
});

describe('MobileMenuButton', () => {
  const mockToggleMobileOpen = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(SidebarContext.useSidebar).mockReturnValue({
      isCollapsed: false,
      setIsCollapsed: vi.fn(),
      toggleCollapse: vi.fn(),
      isMobileOpen: false,
      setIsMobileOpen: vi.fn(),
      toggleMobileOpen: mockToggleMobileOpen,
      closeMobile: vi.fn(),
    });
  });

  it('renders a button', () => {
    render(<MobileMenuButton />);

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('has accessible label "Open menu"', () => {
    render(<MobileMenuButton />);

    expect(
      screen.getByRole('button', { name: 'Open menu' })
    ).toBeInTheDocument();
  });

  it('calls toggleMobileOpen when clicked', () => {
    render(<MobileMenuButton />);

    fireEvent.click(screen.getByRole('button'));

    expect(mockToggleMobileOpen).toHaveBeenCalledTimes(1);
  });

  it('applies correct styling classes', () => {
    render(<MobileMenuButton />);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('md:hidden');
    expect(button).toHaveClass('p-2');
    expect(button).toHaveClass('rounded-lg');
  });
});
