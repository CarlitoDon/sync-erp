import { Link, useNavigate } from 'react-router-dom';
import { useSidebar } from '@/contexts/SidebarContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import SidebarNav from '@/components/layout/SidebarNav';
import CompanySwitcher from '@/components/layout/CompanySwitcher';
import {
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { BrandMark } from '@/components/brand/BrandMark';

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
          fixed top-0 left-0 z-50 h-screen border-r border-slate-800 bg-slate-950 text-white
          flex flex-col transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-16' : 'w-64'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        {/* Logo Header */}
        <div
          className={`
          flex items-center h-16 px-4 border-b border-white/10
          ${isCollapsed ? 'justify-center' : 'justify-between'}
        `}
        >
          <Link to="/dashboard" className="flex items-center gap-2">
            <BrandMark tone="light" />
            {!isCollapsed && (
              <span className="text-lg font-semibold text-white">
                Sync ERP
              </span>
            )}
          </Link>

          {/* Desktop collapse toggle */}
          {!isCollapsed && (
            <button
              onClick={toggleCollapse}
              className="hidden rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white md:flex"
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
            className="mx-auto mt-4 hidden rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white md:flex"
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
          mt-auto border-t border-white/10 p-3 space-y-2
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
            <div className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2">
              <p className="truncate text-sm font-medium text-white">
                {user.name}
              </p>
              {currentCompany && (
                <p className="truncate text-xs text-slate-400">
                  {currentCompany.name}
                </p>
              )}
            </div>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            className={`
              flex items-center gap-2 w-full px-3 py-2 text-red-300 hover:bg-red-500/10 hover:text-red-200 rounded-md transition-colors
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
