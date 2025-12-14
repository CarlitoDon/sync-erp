import {
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from '@heroicons/react/24/outline';
import { useSidebar } from '../../contexts/SidebarContext';

export default function SidebarToggle() {
  const { isCollapsed, toggleCollapse } = useSidebar();

  return (
    <button
      onClick={toggleCollapse}
      className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
      title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      {isCollapsed ? (
        <ChevronDoubleRightIcon className="w-5 h-5" />
      ) : (
        <ChevronDoubleLeftIcon className="w-5 h-5" />
      )}
    </button>
  );
}
