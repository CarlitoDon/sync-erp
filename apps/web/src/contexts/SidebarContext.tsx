import { createContext, useContext, ReactNode } from 'react';
import { useSidebarState } from '../hooks/useSidebarState';

export interface SidebarContextType {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
  toggleCollapse: () => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (value: boolean) => void;
  toggleMobileOpen: () => void;
  closeMobile: () => void;
}

export const SidebarContext = createContext<
  SidebarContextType | undefined
>(undefined);

export function SidebarProvider({
  children,
}: {
  children: ReactNode;
}) {
  const sidebarState = useSidebarState();

  return (
    <SidebarContext.Provider value={sidebarState}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error(
      'useSidebar must be used within a SidebarProvider'
    );
  }
  return context;
}
