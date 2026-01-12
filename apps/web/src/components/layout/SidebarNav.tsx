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
  ArrowUpTrayIcon,
  CurrencyDollarIcon,
  Cog6ToothIcon,
  ClipboardDocumentListIcon,
  WalletIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';

export default function SidebarNav() {
  return (
    <nav className="flex-1 px-3 py-4 overflow-y-auto">
      {/* Dashboard */}
      <SidebarItem path="/" label="Dashboard" icon={<HomeIcon />} />

      {/* Sales Division */}
      <SidebarGroup label="Sales" icon={<CurrencyDollarIcon />}>
        <SidebarItem
          path="/customers"
          label="Customers"
          icon={<UserGroupIcon />}
        />
        <SidebarItem
          path="/quotations"
          label="Quotations"
          icon={<ClipboardDocumentListIcon />}
        />
        <SidebarItem
          path="/sales-orders"
          label="Sales Orders"
          icon={<ShoppingCartIcon />}
        />
      </SidebarGroup>

      {/* Purchasing Division */}
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
      </SidebarGroup>

      {/* Inventory Division - Operations Hub */}
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
        <SidebarItem
          path="/receipts"
          label="Receipts"
          icon={<ArrowDownTrayIcon />}
        />
        <SidebarItem
          path="/shipments"
          label="Deliveries"
          icon={<ArrowUpTrayIcon />}
        />
      </SidebarGroup>

      {/* Finance Division */}
      <SidebarGroup label="Finance" icon={<BanknotesIcon />}>
        <SidebarItem
          path="/invoices"
          label="Customer Invoices"
          icon={<DocumentTextIcon />}
        />
        <SidebarItem
          path="/bills"
          label="Vendor Bills"
          icon={<CreditCardIcon />}
        />
        <SidebarItem
          path="/payments"
          label="Payments"
          icon={<WalletIcon />}
        />
        <SidebarItem
          path="/cash-bank"
          label="Cash & Bank"
          icon={<BanknotesIcon />}
        />
        <SidebarItem
          path="/expenses"
          label="Expenses"
          icon={<BanknotesIcon />}
        />
        <SidebarItem
          path="/finance"
          label="Journal & Ledger"
          icon={<BanknotesIcon />}
        />
      </SidebarGroup>

      {/* Settings */}
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
      {/* Rental feature */}
      <SidebarGroup label="Rental" icon={<ArchiveBoxIcon />}>
        <SidebarItem
          path="/rental/items"
          label="Items"
          icon={<ArchiveBoxIcon />}
        />
        <SidebarItem
          path="/rental/bundles"
          label="Bundles"
          icon={<CubeIcon />}
        />
        <SidebarItem
          path="/rental/orders"
          label="Orders"
          icon={<ShoppingCartIcon />}
        />
        <SidebarItem
          path="/rental/returns"
          label="Returns"
          icon={<DocumentTextIcon />}
        />
        <SidebarItem
          path="/rental/overdue"
          label="Overdue"
          icon={<DocumentCheckIcon />}
        />
        <SidebarItem
          path="/rental/scheduler"
          label="Scheduler"
          icon={<CalendarDaysIcon />}
        />
        <SidebarItem
          path="/rental/settings"
          label="Settings"
          icon={<Cog6ToothIcon />}
        />
      </SidebarGroup>
    </nav>
  );
}
