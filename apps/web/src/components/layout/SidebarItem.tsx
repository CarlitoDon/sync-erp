import { Link, useLocation } from 'react-router-dom';
import { useSidebar } from '../../contexts/SidebarContext';

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
        flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
        ${
          isActive
            ? 'bg-primary-100 text-primary-700 font-medium'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }
        ${isCollapsed ? 'justify-center' : ''}
      `}
      title={isCollapsed ? label : undefined}
    >
      <span
        className={`flex-shrink-0 w-5 h-5 ${isActive ? 'text-primary-600' : 'text-gray-500'}`}
      >
        {icon}
      </span>
      {!isCollapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}
