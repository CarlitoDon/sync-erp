import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'sidebar_collapsed';

export function useSidebarState() {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'true';
  });

  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isCollapsed));
  }, [isCollapsed]);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const toggleMobileOpen = useCallback(() => {
    setIsMobileOpen((prev) => !prev);
  }, []);

  const closeMobile = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  return {
    isCollapsed,
    setIsCollapsed,
    toggleCollapse,
    isMobileOpen,
    setIsMobileOpen,
    toggleMobileOpen,
    closeMobile,
  };
}
