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
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
        ${
          isActive
            ? 'bg-white/[0.1] font-semibold text-white shadow-sm ring-1 ring-inset ring-white/[0.08]'
            : 'font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white'
        }
        ${isCompact ? 'justify-center px-0' : ''}
      `}
      title={isCompact ? label : undefined}
    >
      {isActive && (
        <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary-300 shadow-[0_0_12px_rgba(165,180,252,0.8)]" />
      )}
      <span
        className={`h-5 w-5 flex-shrink-0 transition-colors ${isActive ? 'text-primary-300' : 'text-slate-400 group-hover:text-slate-200'}`}
      >
        {icon}
      </span>
      {!isCompact && <span className="truncate">{label}</span>}
    </Link>
  );
}
