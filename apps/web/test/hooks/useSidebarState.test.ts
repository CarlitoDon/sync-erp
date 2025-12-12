import { renderHook, act } from '@testing-library/react';
import { useSidebarState } from '../../src/hooks/useSidebarState';

describe('useSidebarState', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useSidebarState());
    expect(result.current.isCollapsed).toBe(false);
    expect(result.current.isMobileOpen).toBe(false);
  });

  it('should toggle collapse state and persist to localStorage', () => {
    const { result } = renderHook(() => useSidebarState());

    act(() => {
      result.current.toggleCollapse();
    });

    expect(result.current.isCollapsed).toBe(true);
    expect(localStorage.getItem('sidebar_collapsed')).toBe('true');

    act(() => {
      result.current.toggleCollapse();
    });

    expect(result.current.isCollapsed).toBe(false);
    expect(localStorage.getItem('sidebar_collapsed')).toBe('false');
  });

  it('should read initial state from localStorage', () => {
    localStorage.setItem('sidebar_collapsed', 'true');
    const { result } = renderHook(() => useSidebarState());
    expect(result.current.isCollapsed).toBe(true);
  });

  it('should toggle mobile menu', () => {
    const { result } = renderHook(() => useSidebarState());
    expect(result.current.isMobileOpen).toBe(false);

    act(() => {
      result.current.toggleMobileOpen();
    });
    expect(result.current.isMobileOpen).toBe(true);
  });

  it('should close mobile menu', () => {
    const { result } = renderHook(() => useSidebarState());

    act(() => {
      result.current.setIsMobileOpen(true);
    });

    act(() => {
      result.current.closeMobile();
    });

    expect(result.current.isMobileOpen).toBe(false);
  });
});
