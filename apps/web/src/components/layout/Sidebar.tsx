import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSidebar } from '@/contexts/SidebarContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import SidebarNav from '@/components/layout/SidebarNav';
import CompanySwitcher from '@/components/layout/CompanySwitcher';
import { BrandMark } from '@/components/brand/BrandMark';
import {
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ArrowRightOnRectangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

export default function Sidebar() {
  const { isCollapsed, toggleCollapse, isMobileOpen, closeMobile } =
    useSidebar();
  const { currentCompany } = useCompany();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isCompact = isCollapsed && !isMobileOpen;

  useEffect(() => {
    if (!isMobileOpen) return;

    const desktopMedia = window.matchMedia('(min-width: 768px)');
    if (desktopMedia.matches) {
      closeMobile();
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMobile();
    };
    const handleDesktopChange = (event: MediaQueryListEvent) => {
      if (event.matches) closeMobile();
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    desktopMedia.addEventListener('change', handleDesktopChange);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      desktopMedia.removeEventListener('change', handleDesktopChange);
    };
  }, [closeMobile, isMobileOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          data-testid="mobile-navigation-overlay"
          className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-[2px] transition-opacity duration-[var(--duration-normal)] ease-[var(--ease-out)] md:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 z-50 flex h-screen max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden
          border-r border-slate-200/80 bg-white/95 backdrop-blur-xl
          text-slate-900 shadow-sm shadow-slate-900/5 transition-all duration-[var(--duration-slow)] ease-[var(--ease-drawer)]
          ${isCompact ? 'w-[4.5rem]' : 'w-[17rem]'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        {/* Logo Header */}
        <div
          className={`
          flex h-16 items-center border-b border-slate-200/80 px-4
          ${isCompact ? 'justify-center' : 'justify-between'}
        `}
        >
          <Link
            to="/dashboard"
            onClick={closeMobile}
            className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <BrandMark tone="gradient" size="sm" />
            {!isCompact && (
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-bold tracking-tight text-slate-950">
                  Sync ERP
                </span>
                <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Operations
                </span>
              </span>
            )}
          </Link>

          {/* Desktop collapse toggle */}
          {!isCompact && (
            <>
              <button
                type="button"
                onClick={closeMobile}
                className="flex rounded-lg p-1.5 text-slate-400 transition duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-[0.96] md:hidden"
                title="Close navigation"
                aria-label="Close navigation"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={toggleCollapse}
                className="hidden rounded-lg p-1.5 text-slate-400 transition duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-[0.96] md:flex"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <ChevronDoubleLeftIcon className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {/* Collapsed expand button */}
        {isCompact && (
          <button
            type="button"
            onClick={toggleCollapse}
            className="mx-auto mt-3 hidden rounded-lg p-2 text-slate-400 transition duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-[0.96] md:flex"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <ChevronDoubleRightIcon className="h-4 w-4" />
          </button>
        )}

        {/* Navigation */}
        <SidebarNav />

        {/* Footer */}
        <div
          className={`
          mt-auto space-y-2 border-t border-slate-200/80 bg-slate-50/50 p-3
          ${isCompact ? 'items-center' : ''}
        `}
        >
          {/* Company Switcher */}
          {!isCompact && (
            <div className="mb-1.5">
              <CompanySwitcher />
            </div>
          )}

          {/* User Profile Pill & Integrated Logout Capsule (Pinterest/Linear Style) */}
          {user && (
            <div
              className={`
                flex items-center rounded-xl border border-slate-200/80 bg-white p-2 shadow-2xs
                ${isCompact ? 'justify-center p-1.5' : 'justify-between gap-2.5'}
              `}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Avatar with Initials */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-[11px] font-bold text-white shadow-2xs">
                  {user.name
                    ?.split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() || 'U'}
                </div>

                {!isCompact && (
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-900 leading-tight">
                      {user.name}
                    </p>
                    <p className="truncate text-[10.5px] font-medium text-slate-500">
                      {user.email || currentCompany?.name || 'Administrator'}
                    </p>
                  </div>
                )}
              </div>

              {!isCompact && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 active:scale-95"
                  title="Logout"
                  aria-label="Logout"
                >
                  <ArrowRightOnRectangleIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {/* Compact logout button */}
          {isCompact && (
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-8 w-8 mx-auto items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
              title="Logout"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
