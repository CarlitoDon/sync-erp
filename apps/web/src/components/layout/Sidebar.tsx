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
          className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-[2px] transition-opacity duration-[var(--duration-normal)] ease-[var(--ease-out)] md:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 z-50 flex h-screen max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden
          border-r border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.18),_transparent_18rem),linear-gradient(180deg,_#111827_0%,_#0b1220_100%)]
          text-white shadow-2xl shadow-slate-950/20 transition-all duration-[var(--duration-slow)] ease-[var(--ease-drawer)]
          ${isCompact ? 'w-[4.5rem]' : 'w-[17rem]'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        {/* Logo Header */}
        <div
          className={`
          flex h-[4.5rem] items-center border-b border-white/[0.08] px-4
          ${isCompact ? 'justify-center' : 'justify-between'}
        `}
        >
          <Link
            to="/dashboard"
            onClick={closeMobile}
            className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <BrandMark tone="light" />
            {!isCompact && (
              <span className="min-w-0">
                <span className="block truncate text-[17px] font-semibold tracking-tight text-white">
                  Sync ERP
                </span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
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
                className="flex rounded-lg p-2 text-slate-300 transition duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 active:scale-[0.96] md:hidden"
                title="Close navigation"
                aria-label="Close navigation"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={toggleCollapse}
                className="hidden rounded-lg p-2 text-slate-400 transition duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 active:scale-[0.96] md:flex"
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
            className="mx-auto mt-3 hidden rounded-lg p-2 text-slate-400 transition duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 active:scale-[0.96] md:flex"
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
          mt-auto space-y-2 border-t border-white/[0.08] bg-black/10 p-3
          ${isCompact ? 'items-center' : ''}
        `}
        >
          {/* Company Switcher */}
          {!isCompact && (
            <div className="mb-2">
              <CompanySwitcher />
            </div>
          )}

          {/* User Info */}
          {!isCompact && user && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-2.5">
              <p className="truncate text-sm font-medium text-slate-100">
                {user.name}
              </p>
              {currentCompany && (
                <p className="mt-0.5 truncate text-xs text-slate-400">
                  {currentCompany.name}
                </p>
              )}
            </div>
          )}

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            className={`
              flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-slate-400 transition duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-rose-400/10 hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 active:scale-[0.98]
              ${isCompact ? 'justify-center' : ''}
            `}
            title={isCompact ? 'Logout' : undefined}
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            {!isCompact && (
              <span className="text-sm font-medium">Logout</span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
