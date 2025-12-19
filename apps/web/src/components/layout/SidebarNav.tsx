import SidebarItem from '@/components/layout/SidebarItem';
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

  // Sales
  { path: '/customers', label: 'Customers', icon: <UserGroupIcon /> },
  {
    path: '/sales-orders',
    label: 'Sales Orders',
    icon: <ShoppingCartIcon />,
  },
  {
    path: '/invoices',
    label: 'Invoices',
    icon: <DocumentTextIcon />,
  },

  // Purchasing
  { path: '/suppliers', label: 'Suppliers', icon: <TruckIcon /> },
  {
    path: '/purchase-orders',
    label: 'Purchase Orders',
    icon: <ClipboardDocumentListIcon />,
  },
  { path: '/bills', label: 'Bills', icon: <CreditCardIcon /> },

  // Inventory
  { path: '/products', label: 'Products', icon: <CubeIcon /> },
  {
    path: '/inventory',
    label: 'Inventory',
    icon: <ArchiveBoxIcon />,
  },
  { path: '/receipts', label: 'Goods Receipts', icon: <TruckIcon /> },
  { path: '/shipments', label: 'Shipments', icon: <TruckIcon /> },

  // Finance
  { path: '/finance', label: 'Finance', icon: <BanknotesIcon /> },

  // System
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
