import { Outlet, Link, useLocation } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar';
import MobileMenuButton from '@/components/layout/MobileMenuButton';
import { useSidebar } from '@/contexts/SidebarContext';
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

  return (
    <div className="app-grid-background flex min-h-screen">
      <AdSenseScript enabled={showAds} />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div
        className={`
        flex min-h-screen min-w-0 flex-1 flex-col transition-[margin] duration-[var(--duration-slow)] ease-[var(--ease-drawer)]
        ${isCollapsed ? 'md:ml-[4.5rem]' : 'md:ml-[17rem]'}
      `}
      >
        {/* Simplified Header (Mobile only shows hamburger) */}
        <header className="glass sticky top-0 z-30 border-b border-slate-200/70 md:hidden">
          <div className="relative flex h-16 items-center justify-between px-4">
            <MobileMenuButton />
            <Link
              to="/dashboard"
              className="absolute left-1/2 flex max-w-[calc(100vw-7rem)] -translate-x-1/2 items-center gap-2"
            >
              <BrandMark size="sm" />
              <span className="truncate text-lg font-semibold text-slate-950">
                Sync ERP
              </span>
            </Link>
            <div className="w-10" /> {/* Spacer for balance */}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1680px]">
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
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-auto border-t border-slate-200/70 bg-white/45 backdrop-blur-sm">
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
