import { Outlet, Link, useLocation } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar';
import MobileMenuButton from '@/components/layout/MobileMenuButton';
import { useSidebar } from '@/contexts/SidebarContext';
<<<<<<< HEAD
import { AdSenseScript } from '@/components/ads/AdSenseScript';
import { AdSenseSlot } from '@/components/ads/AdSenseSlot';
import { getFooterAdSenseSlot } from '@/components/ads/adsense';
import { useBillingFeatures } from '@/hooks/useBillingFeatures';
import { BrandMark } from '@/components/brand/BrandMark';

export default function Layout() {
  const { isCollapsed } = useSidebar();
  const location = useLocation();
  const { adsEnabled } = useBillingFeatures();
  const suppressAds =
    location.search.includes('checkout=') ||
    location.pathname.includes('/print') ||
    location.pathname.includes('/export');
  const showAds = adsEnabled && !suppressAds;
=======

export default function Layout() {
  const { isCollapsed } = useSidebar();
>>>>>>> origin/dev

  return (
    <div className="app-grid-background flex min-h-screen">
      <AdSenseScript enabled={showAds} />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div
        className={`
<<<<<<< HEAD
        flex-1 min-w-0 flex flex-col min-h-screen transition-all duration-300
=======
        flex-1 flex flex-col min-h-screen transition-all duration-300
>>>>>>> origin/dev
        ${isCollapsed ? 'md:ml-16' : 'md:ml-64'}
      `}
      >
        {/* Simplified Header (Mobile only shows hamburger) */}
        <header className="glass sticky top-0 z-30 shadow-sm md:hidden">
          <div className="relative flex h-14 items-center justify-between px-4">
            <MobileMenuButton />
<<<<<<< HEAD
            <Link
              to="/dashboard"
              className="absolute left-1/2 flex max-w-[calc(100vw-7rem)] -translate-x-1/2 items-center gap-2"
            >
              <BrandMark size="sm" />
              <span className="truncate text-lg font-semibold text-slate-950">
=======
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">
                  S
                </span>
              </div>
              <span className="text-lg font-semibold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
>>>>>>> origin/dev
                Sync ERP
              </span>
            </Link>
            <div className="w-10" /> {/* Spacer for balance */}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6">
          <AdSenseSlot
            enabled={showAds}
            className="mb-6 min-h-[90px]"
          />
          <Outlet />
          <AdSenseSlot
            enabled={showAds}
            slot={getFooterAdSenseSlot()}
            className="mt-6 min-h-[90px]"
          />
        </main>

        {/* Footer */}
        <footer className="mt-auto border-t border-slate-200/70 bg-white/55 backdrop-blur-sm">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <p className="text-center text-sm text-slate-500">
              © {new Date().getFullYear()} Sync ERP. Multi-Company
              Enterprise Resource Planning.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
