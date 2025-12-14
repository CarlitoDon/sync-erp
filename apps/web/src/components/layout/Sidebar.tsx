import { Link, useNavigate } from 'react-router-dom';
import { useSidebar } from '../../contexts/SidebarContext';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import SidebarNav from './SidebarNav';
import CompanySwitcher from './CompanySwitcher';
import {
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';

export default function Sidebar() {
  const { isCollapsed, toggleCollapse, isMobileOpen, closeMobile } =
    useSidebar();
  const { currentCompany } = useCompany();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-screen bg-white border-r border-gray-200
          flex flex-col transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-16' : 'w-64'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        {/* Logo Header */}
        <div
          className={`
          flex items-center h-16 px-4 border-b border-gray-200
          ${isCollapsed ? 'justify-center' : 'justify-between'}
        `}
        >
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            {!isCollapsed && (
              <span className="text-lg font-semibold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
                Sync ERP
              </span>
            )}
          </Link>

          {/* Desktop collapse toggle */}
          {!isCollapsed && (
            <button
              onClick={toggleCollapse}
              className="hidden md:flex p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              title="Collapse sidebar"
            >
              <ChevronDoubleLeftIcon className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Collapsed expand button */}
        {isCollapsed && (
          <button
            onClick={toggleCollapse}
            className="hidden md:flex mx-auto mt-4 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            title="Expand sidebar"
          >
            <ChevronDoubleRightIcon className="w-5 h-5" />
          </button>
        )}

        {/* Navigation */}
        <SidebarNav />

        {/* Footer */}
        <div
          className={`
          mt-auto border-t border-gray-200 p-3 space-y-2
          ${isCollapsed ? 'items-center' : ''}
        `}
        >
          {/* Company Switcher */}
          {!isCollapsed && (
            <div className="mb-2">
              <CompanySwitcher />
            </div>
          )}

          {/* User Info */}
          {!isCollapsed && user && (
            <div className="px-3 py-2 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user.name}
              </p>
              {currentCompany && (
                <p className="text-xs text-gray-500 truncate">
                  {currentCompany.name}
                </p>
              )}
            </div>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            className={`
              flex items-center gap-2 w-full px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors
              ${isCollapsed ? 'justify-center' : ''}
            `}
            title={isCollapsed ? 'Logout' : undefined}
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            {!isCollapsed && <span className="text-sm">Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
