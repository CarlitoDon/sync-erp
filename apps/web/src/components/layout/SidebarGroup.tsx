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
  const { isCollapsed } = useSidebar();

  // When sidebar is collapsed, show icon only
  if (isCollapsed) {
    return <div className="space-y-1">{children}</div>;
  }

  return (
    <div className="mt-4 first:mt-0">
      {/* Group Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="
          w-full flex items-center gap-2 px-3 py-1.5
          text-[11px] font-semibold text-gray-400 uppercase tracking-wider
          hover:text-gray-600 transition-colors
          group
        "
      >
        <ChevronRightIcon
          className={`w-3.5 h-3.5 text-gray-400 group-hover:text-gray-500 transition-transform duration-200 ${
            isOpen ? 'rotate-90' : 'rotate-0'
          }`}
        />
        <span className="w-4 h-4">{icon}</span>
        <span>{label}</span>
      </button>

      {/* Group Items */}
      <div
        className={`
          mt-1 space-y-0.5 overflow-hidden transition-all duration-200 ease-in-out
          ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}
        `}
      >
        {children}
      </div>
    </div>
  );
}
