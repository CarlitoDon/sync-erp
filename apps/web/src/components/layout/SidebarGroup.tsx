import { useState, ReactNode } from 'react';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { useSidebar } from '@/contexts/SidebarContext';

interface SidebarGroupProps {
  label: string;
  icon: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}

export default function SidebarGroup({
  label,
  icon,
  children,
  defaultOpen = true,
}: SidebarGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { isCollapsed, isMobileOpen } = useSidebar();
  const isCompact = isCollapsed && !isMobileOpen;

  // When sidebar is collapsed, show icon only
  if (isCompact) {
    return <div className="space-y-1">{children}</div>;
  }

  return (
    <div className="mt-4 first:mt-0">
      {/* Group Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="
          group flex w-full items-center gap-2 rounded-lg px-3 py-1.5
          text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400
          transition-colors duration-[var(--duration-fast)] hover:text-slate-200
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300
        "
      >
        <ChevronRightIcon
          className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-[var(--duration-normal)] ease-[var(--ease-out)] group-hover:text-slate-300 ${
            isOpen ? 'rotate-90' : 'rotate-0'
          }`}
        />
        <span className="w-4 h-4">{icon}</span>
        <span>{label}</span>
      </button>

      {/* Group Items */}
      <div
        className={`
          mt-1 space-y-1 overflow-hidden pl-1 transition-all duration-[var(--duration-normal)] ease-[var(--ease-out)]
          ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}
        `}
      >
        {children}
      </div>
    </div>
  );
}
