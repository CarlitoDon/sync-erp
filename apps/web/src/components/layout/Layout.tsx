import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar';
import MobileMenuButton from '@/components/layout/MobileMenuButton';
import { useSidebar } from '@/contexts/SidebarContext';
import { AdSenseScript } from '@/components/ads/AdSenseScript';
import { AdSenseSlot } from '@/components/ads/AdSenseSlot';
import { getFooterAdSenseSlot } from '@/components/ads/adsense';
import { useBillingFeatures } from '@/hooks/useBillingFeatures';

import { useCompany } from '@/contexts/CompanyContext';

export default function Layout() {
  const { isCollapsed } = useSidebar();
  const { currentCompany } = useCompany();
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
        {/* Sticky Top Header (Mobile only, hidden on desktop) */}
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md md:hidden">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="md:hidden">
                <MobileMenuButton />
              </div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 via-blue-500 to-sky-400 text-xs font-bold text-white shadow-sm shadow-blue-500/25 ring-1 ring-white/20">
                  {currentCompany?.name?.charAt(0) || 'S'}
                </div>
                <div className="min-w-0">
                  <span className="truncate text-sm font-bold tracking-tight text-slate-900">
                    {currentCompany?.name || 'Sync ERP'}
                  </span>
                  <span className="ml-2 inline-flex items-center rounded border border-blue-200/60 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                    {currentCompany?.businessShape === 'RENTAL'
                      ? 'Rental & Sewa'
                      : currentCompany?.businessShape || 'Operations'}
                  </span>
                </div>
              </div>
            </div>
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
