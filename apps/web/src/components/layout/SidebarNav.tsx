import SidebarItem from '@/components/layout/SidebarItem';
import SidebarGroup from '@/components/layout/SidebarGroup';
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
  ChartBarIcon,
  UsersIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';

export default function SidebarNav() {
  return (
    <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
      {/* Dashboard - Always visible at top */}
      <SidebarItem path="/" label="Dashboard" icon={<HomeIcon />} />

      {/* Sales Division */}
      <SidebarGroup label="Sales" icon={<ChartBarIcon />}>
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
          path="/invoices"
          label="Invoices"
          icon={<DocumentTextIcon />}
        />
        <SidebarItem
          path="/shipments"
          label="Shipments"
          icon={<TruckIcon />}
        />
      </SidebarGroup>

      {/* Procurement Division */}
      <SidebarGroup
        label="Procurement"
        icon={<ClipboardDocumentListIcon />}
      >
        <SidebarItem
          path="/suppliers"
          label="Suppliers"
          icon={<TruckIcon />}
        />
        <SidebarItem
          path="/purchase-orders"
          label="Purchase Orders"
          icon={<ClipboardDocumentCheckIcon />}
        />
        <SidebarItem
          path="/bills"
          label="Bills"
          icon={<CreditCardIcon />}
        />
        <SidebarItem
          path="/receipts"
          label="Goods Receipts"
          icon={<TruckIcon />}
        />
      </SidebarGroup>

      {/* Inventory Division */}
      <SidebarGroup label="Inventory" icon={<ArchiveBoxIcon />}>
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
          path="/finance"
          label="Journal & Ledger"
          icon={<BanknotesIcon />}
        />
      </SidebarGroup>

      {/* Administration */}
      <SidebarGroup
        label="Admin"
        icon={<BuildingOfficeIcon />}
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
