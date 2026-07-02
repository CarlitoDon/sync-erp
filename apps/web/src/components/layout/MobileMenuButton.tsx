import { Bars3Icon } from '@heroicons/react/24/outline';
import { useSidebar } from '@/contexts/SidebarContext';

export default function MobileMenuButton() {
  const { toggleMobileOpen } = useSidebar();

  return (
    <button
      onClick={toggleMobileOpen}
      className="rounded-md p-2 text-slate-700 transition-colors hover:bg-slate-100 md:hidden"
      aria-label="Open menu"
    >
      <Bars3Icon className="w-6 h-6" />
    </button>
  );
}
