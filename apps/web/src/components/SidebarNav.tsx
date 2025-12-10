import SidebarItem from './SidebarItem';
import {
  HomeIcon,
  TruckIcon,
  CubeIcon,
  ClipboardDocumentListIcon,
  ShoppingCartIcon,
  ArchiveBoxIcon,
  DocumentTextIcon,
  BanknotesIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';

const navItems = [
  { path: '/', label: 'Dashboard', icon: <HomeIcon /> },
  { path: '/suppliers', label: 'Suppliers', icon: <TruckIcon /> },
  { path: '/products', label: 'Products', icon: <CubeIcon /> },
  { path: '/purchase-orders', label: 'Purchase Orders', icon: <ClipboardDocumentListIcon /> },
  { path: '/sales-orders', label: 'Sales Orders', icon: <ShoppingCartIcon /> },
  { path: '/inventory', label: 'Inventory', icon: <ArchiveBoxIcon /> },
  { path: '/invoices', label: 'Invoices', icon: <DocumentTextIcon /> },
  { path: '/finance', label: 'Finance', icon: <BanknotesIcon /> },
  { path: '/companies', label: 'Companies', icon: <BuildingOfficeIcon /> },
];

export default function SidebarNav() {
  return (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {navItems.map((item) => (
        <SidebarItem key={item.path} path={item.path} label={item.label} icon={item.icon} />
      ))}
    </nav>
  );
}
