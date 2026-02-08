import { vi } from 'vitest';

export const mockUseAuth = vi.fn(() => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  checkAuth: vi.fn(),
}));

export const mockUseCompany = vi.fn(() => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentCompany: null as any,
  companies: [],
  setCurrentCompany: vi.fn(),
  refreshCompanies: vi.fn(),
  isLoading: false,
}));

export const mockUseSidebarState = vi.fn(() => ({
  isCollapsed: false,
  isMobileOpen: false,
  toggleCollapse: vi.fn(),
  toggleMobileOpen: vi.fn(),
  setIsCollapsed: vi.fn(),
  setIsMobileOpen: vi.fn(),
  closeMobile: vi.fn(),
}));
