import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SidebarToggle from '../../src/components/SidebarToggle';
import { SidebarContext, SidebarContextType } from '../../src/contexts/SidebarContext';

// Helper to define context structure
type MockSidebarContext = Partial<SidebarContextType>;

const renderWithContext = (ui: React.ReactNode, contextValues: MockSidebarContext) => {
  return render(
    <SidebarContext.Provider value={contextValues as SidebarContextType}>
      {ui}
    </SidebarContext.Provider>
  );
};

// Default mock context values
const defaultContext = {
  isCollapsed: false,
  setIsCollapsed: vi.fn(),
  toggleCollapse: vi.fn(),
  isMobileOpen: false,
  setIsMobileOpen: vi.fn(),
  toggleMobileOpen: vi.fn(),
  closeMobile: vi.fn(),
};

describe('SidebarToggle', () => {
  it('renders correctly when expanded', () => {
    renderWithContext(<SidebarToggle />, { ...defaultContext, isCollapsed: false });

    // Should show collapse icon/tooltip
    expect(screen.getByTitle('Collapse sidebar')).toBeInTheDocument();
  });

  it('renders correctly when collapsed', () => {
    renderWithContext(<SidebarToggle />, { ...defaultContext, isCollapsed: true });

    // Should show expand icon/tooltip
    expect(screen.getByTitle('Expand sidebar')).toBeInTheDocument();
  });

  it('calls toggleCollapse when clicked', () => {
    const toggleCollapse = vi.fn();
    renderWithContext(<SidebarToggle />, { ...defaultContext, toggleCollapse });

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(toggleCollapse).toHaveBeenCalled();
  });
});
