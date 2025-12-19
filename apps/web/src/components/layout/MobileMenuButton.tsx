import { Bars3Icon } from '@heroicons/react/24/outline';
import { useSidebar } from '@/contexts/SidebarContext';

export default function MobileMenuButton() {
  const { toggleMobileOpen } = useSidebar();

  return (
    <button
      onClick={toggleMobileOpen}
      className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
      aria-label="Open menu"
    >
      <Bars3Icon className="w-6 h-6" />
    </button>
  );
}
