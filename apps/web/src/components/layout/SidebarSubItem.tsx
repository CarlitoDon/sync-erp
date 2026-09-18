import { Link, useLocation } from 'react-router-dom';
import { useSidebar } from '@/contexts/SidebarContext';

interface SidebarSubItemProps {
  path: string;
  label: string;
  badge?: string | number;
}

export default function SidebarSubItem({
  path,
  label,
  badge,
}: SidebarSubItemProps) {
  const location = useLocation();
  const { closeMobile } = useSidebar();

  const isActive =
    path === '/'
      ? location.pathname === '/'
      : location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <Link
      to={path}
      onClick={closeMobile}
      aria-current={isActive ? 'page' : undefined}
      className={`
        group relative flex items-center justify-between rounded-lg py-1.5 pl-3 pr-2.5 text-[13px]
        transition duration-[var(--duration-fast)] ease-[var(--ease-out)]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
        ${
          isActive
            ? 'bg-blue-50/90 font-semibold text-blue-700 shadow-2xs'
            : 'font-medium text-slate-500 hover:bg-slate-100/70 hover:text-slate-900'
        }
      `}
    >
      {/* Active node on the connector branch line */}
      {isActive && (
        <span
          className="absolute -left-[14px] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-blue-600 ring-2 ring-white"
          aria-hidden="true"
        />
      )}
      <span className="truncate">{label}</span>
      {badge !== undefined && (
        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
          {badge}
        </span>
      )}
    </Link>
  );
}
