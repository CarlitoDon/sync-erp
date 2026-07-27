import { Bars3Icon } from '@heroicons/react/24/outline';
import { useSidebar } from '@/contexts/SidebarContext';

export default function MobileMenuButton() {
  const { toggleMobileOpen } = useSidebar();

  return (
    <button
      type="button"
      onClick={toggleMobileOpen}
      className="rounded-xl border border-slate-200/80 bg-white p-2 text-slate-700 shadow-sm transition duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 active:scale-[0.96] md:hidden"
      aria-label="Open menu"
    >
      <Bars3Icon className="w-6 h-6" />
    </button>
  );
}
