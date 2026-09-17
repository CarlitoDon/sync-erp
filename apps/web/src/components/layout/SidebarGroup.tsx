import { useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { useSidebar } from '@/contexts/SidebarContext';

interface SidebarGroupProps {
  label: string;
  icon: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  activePrefixes?: string[];
}

export default function SidebarGroup({
  label,
  icon,
  children,
  defaultOpen = false,
  activePrefixes = [],
}: SidebarGroupProps) {
  const location = useLocation();
  const { isCollapsed, isMobileOpen } = useSidebar();
  const isCompact = isCollapsed && !isMobileOpen;

  // Check if any route under this group is currently active
  const isChildActive = activePrefixes.some(
    (prefix) =>
      location.pathname === prefix || location.pathname.startsWith(`${prefix}/`)
  );

  const [isOpen, setIsOpen] = useState(defaultOpen || isChildActive);

  // Auto-expand group if current route navigates inside this group
  useEffect(() => {
    if (isChildActive) {
      setIsOpen(true);
    }
  }, [isChildActive]);

  // When sidebar is collapsed, show compact icon
  if (isCompact) {
    return (
      <div className="py-1">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title={label}
          className={`
            flex h-10 w-10 mx-auto items-center justify-center rounded-xl text-slate-500
            transition duration-[var(--duration-fast)] ease-[var(--ease-out)]
            hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
            ${isChildActive ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-200/60' : ''}
          `}
        >
          <span className="h-5 w-5">{icon}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mt-1">
      {/* Group Header Row */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className={`
          group flex w-full items-center justify-between rounded-xl px-3 py-2 text-[13.5px]
          transition duration-[var(--duration-fast)] ease-[var(--ease-out)]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
          ${
            isChildActive
              ? 'font-semibold text-slate-900'
              : 'font-medium text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
          }
        `}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`h-5 w-5 flex-shrink-0 transition-colors ${
              isChildActive
                ? 'text-blue-600'
                : 'text-slate-400 group-hover:text-slate-600'
            }`}
          >
            {icon}
          </span>
          <span className="truncate">{label}</span>
        </div>

        <ChevronRightIcon
          className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-[var(--duration-normal)] ease-[var(--ease-out)] group-hover:text-slate-600 ${
            isOpen ? 'rotate-90' : 'rotate-0'
          }`}
        />
      </button>

      {/* Sub-items Tree Branch Container */}
      <div
        className={`
          overflow-hidden transition-all duration-[var(--duration-normal)] ease-[var(--ease-out)]
          ${isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}
        `}
      >
        <div className="relative ml-[1.35rem] my-1 space-y-0.5 border-l border-slate-200/90 pl-2.5">
          {children}
        </div>
      </div>
    </div>
  );
}

