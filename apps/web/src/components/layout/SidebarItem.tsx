import { Link, useLocation } from 'react-router-dom';
import { useSidebar } from '@/contexts/SidebarContext';

interface SidebarItemProps {
  path: string;
  label: string;
  icon: React.ReactNode;
}

export default function SidebarItem({
  path,
  label,
  icon,
}: SidebarItemProps) {
  const location = useLocation();
  const { isCollapsed, isMobileOpen, closeMobile } = useSidebar();
  const isCompact = isCollapsed && !isMobileOpen;

  const isActive =
    path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(path);

  const handleClick = () => {
    // Close mobile sidebar on navigation
    closeMobile();
  };

  return (
    <Link
      to={path}
      onClick={handleClick}
      aria-current={isActive ? 'page' : undefined}
      className={`
        group relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[13px]
        transition duration-[var(--duration-normal)] ease-[var(--ease-out)]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white
        ${
          isActive
            ? 'bg-blue-50 font-semibold text-blue-700 ring-1 ring-blue-200/60 shadow-2xs'
            : 'font-medium text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
        }
        ${isCompact ? 'justify-center px-0' : ''}
      `}
      title={isCompact ? label : undefined}
    >
      {isActive && (
        <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-blue-600" />
      )}
      <span
        className={`h-5 w-5 flex-shrink-0 transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`}
      >
        {icon}
      </span>
      {!isCompact && <span className="truncate">{label}</span>}
    </Link>
  );
}
