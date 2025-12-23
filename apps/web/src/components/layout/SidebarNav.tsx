import SidebarItem from '@/components/layout/SidebarItem';
import SidebarGroup from '@/components/layout/SidebarGroup';
import {
  HomeIcon,
  TruckIcon,
  UserGroupIcon,
  CubeIcon,
  ShoppingCartIcon,
  ArchiveBoxIcon,
  DocumentTextIcon,
  BanknotesIcon,
  BuildingOfficeIcon,
  CreditCardIcon,
  UsersIcon,
  DocumentCheckIcon,
  ArrowDownTrayIcon,
  PaperAirplaneIcon,
  CurrencyDollarIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';

export default function SidebarNav() {
  return (
    <nav className="flex-1 px-3 py-4 overflow-y-auto">
      {/* Dashboard - Always visible at top */}
      <SidebarItem path="/" label="Dashboard" icon={<HomeIcon />} />

      {/* Sales Division */}
      <SidebarGroup label="Sales" icon={<CurrencyDollarIcon />}>
        <SidebarItem
          path="/customers"
          label="Customers"
          icon={<UserGroupIcon />}
        />
        <SidebarItem
          path="/sales-orders"
          label="Sales Orders"
          icon={<ShoppingCartIcon />}
        />
        <SidebarItem
          path="/shipments"
          label="Shipments"
          icon={<PaperAirplaneIcon />}
        />
      </SidebarGroup>

      {/* Procurement Division */}
      <SidebarGroup label="Purchasing" icon={<ArrowDownTrayIcon />}>
        <SidebarItem
          path="/suppliers"
          label="Suppliers"
          icon={<TruckIcon />}
        />
        <SidebarItem
          path="/purchase-orders"
          label="Purchase Orders"
          icon={<DocumentCheckIcon />}
        />
        <SidebarItem
          path="/receipts"
          label="Goods Receipts"
          icon={<ArchiveBoxIcon />}
        />
      </SidebarGroup>

      {/* Inventory Division */}
      <SidebarGroup label="Inventory" icon={<CubeIcon />}>
        <SidebarItem
          path="/products"
          label="Products"
          icon={<CubeIcon />}
        />
        <SidebarItem
          path="/inventory"
          label="Stock Levels"
          icon={<ArchiveBoxIcon />}
        />
      </SidebarGroup>

      {/* Finance Division */}
      <SidebarGroup label="Finance" icon={<BanknotesIcon />}>
        <SidebarItem
          path="/invoices"
          label="Invoices"
          icon={<DocumentTextIcon />}
        />
        <SidebarItem
          path="/bills"
          label="Bills"
          icon={<CreditCardIcon />}
        />
        <SidebarItem
          path="/finance"
          label="Journal & Ledger"
          icon={<BanknotesIcon />}
        />
      </SidebarGroup>

      {/* Settings - collapsed by default */}
      <SidebarGroup
        label="Settings"
        icon={<Cog6ToothIcon />}
        defaultOpen={false}
      >
        <SidebarItem
          path="/companies"
          label="Companies"
          icon={<BuildingOfficeIcon />}
        />
        <SidebarItem path="/team" label="Team" icon={<UsersIcon />} />
      </SidebarGroup>
    </nav>
  );
}
