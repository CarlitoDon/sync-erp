import SidebarItem from './SidebarItem';
import {
  HomeIcon,
  TruckIcon,
  UserGroupIcon,
  CubeIcon,
  ClipboardDocumentListIcon,
  ShoppingCartIcon,
  ArchiveBoxIcon,
  DocumentTextIcon,
  BanknotesIcon,
  BuildingOfficeIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline';

const navItems = [
  { path: '/', label: 'Dashboard', icon: <HomeIcon /> },
  { path: '/suppliers', label: 'Suppliers', icon: <TruckIcon /> },
  { path: '/customers', label: 'Customers', icon: <UserGroupIcon /> },
  { path: '/products', label: 'Products', icon: <CubeIcon /> },
  {
    path: '/purchase-orders',
    label: 'Purchase Orders',
    icon: <ClipboardDocumentListIcon />,
  },
  { path: '/bills', label: 'Bills', icon: <CreditCardIcon /> },
  {
    path: '/sales-orders',
    label: 'Sales Orders',
    icon: <ShoppingCartIcon />,
  },
  {
    path: '/inventory',
    label: 'Inventory',
    icon: <ArchiveBoxIcon />,
  },
  {
    path: '/invoices',
    label: 'Invoices',
    icon: <DocumentTextIcon />,
  },
  { path: '/finance', label: 'Finance', icon: <BanknotesIcon /> },
  {
    path: '/companies',
    label: 'Companies',
    icon: <BuildingOfficeIcon />,
  },
  {
    path: '/team',
    label: 'Team',
    icon: <UserGroupIcon />,
  },
];

export default function SidebarNav() {
  return (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {navItems.map((item) => (
        <SidebarItem
          key={item.path}
          path={item.path}
          label={item.label}
          icon={item.icon}
        />
      ))}
    </nav>
  );
}
