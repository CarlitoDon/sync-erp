import { useState, ReactNode } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
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
    <div className="mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="
          w-full flex items-center justify-between px-3 py-2
          text-xs font-semibold text-gray-500 uppercase tracking-wider
          hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors
        "
      >
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 text-gray-400">{icon}</span>
          <span>{label}</span>
        </div>
        <ChevronDownIcon
          className={`w-4 h-4 transition-transform duration-200 ${
            isOpen ? 'rotate-0' : '-rotate-90'
          }`}
        />
      </button>
      <div
        className={`
          space-y-0.5 pl-1 overflow-hidden transition-all duration-200
          ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}
        `}
      >
        {children}
      </div>
    </div>
  );
}
