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
  const { isCollapsed, closeMobile } = useSidebar();

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
      className={`
        flex items-center gap-3 rounded-md px-3 py-2.5 transition-all duration-200
        ${
          isActive
            ? 'bg-white/[0.08] font-medium text-white shadow-sm'
            : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
        }
        ${isCollapsed ? 'justify-center' : ''}
      `}
      title={isCollapsed ? label : undefined}
    >
      <span
        className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-cyan-300' : 'text-slate-400'}`}
      >
        {icon}
      </span>
      {!isCollapsed && (
        <>
          <span className="truncate">{label}</span>
          {isActive && (
            <span className="ml-auto h-2 w-2 rounded-full bg-cyan-300" />
          )}
        </>
      )}
    </Link>
  );
}
