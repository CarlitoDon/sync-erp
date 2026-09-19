import SidebarItem from '@/components/layout/SidebarItem';
import SidebarGroup from '@/components/layout/SidebarGroup';
import SidebarSubItem from '@/components/layout/SidebarSubItem';
import {
  HomeIcon,
  CubeIcon,
  ArchiveBoxIcon,
  BanknotesIcon,
  ArrowDownTrayIcon,
  CurrencyDollarIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { useCompany } from '@/contexts/CompanyContext';
import { BusinessShape } from '@sync-erp/shared';

export default function SidebarNav() {
  const { currentCompany } = useCompany();

  return (
    <nav
      className="sidebar-scrollbar flex-1 overflow-y-auto px-3 py-3"
      aria-label="Primary navigation"
    >
      {/* 01. Dashboard - Primary Hub */}
      <SidebarItem
        path="/dashboard"
        label="Dashboard"
        icon={<HomeIcon />}
      />

      {/* 02. Rental feature - Top Priority for Rental business (e.g. Santi Living) */}
      {currentCompany?.businessShape === BusinessShape.RENTAL && (
        <SidebarGroup
          label="Rental Operations"
          icon={<ArchiveBoxIcon />}
          activePrefixes={['/rental']}
          defaultPath="/rental/tasks"
        >
          <SidebarSubItem path="/rental/tasks" label="Tugas Admin" />
          <SidebarSubItem path="/rental/scheduler" label="Scheduler Kalender" />
          <SidebarSubItem path="/rental/orders" label="Daftar Pesanan Sewa" />
          <SidebarSubItem path="/rental/items" label="Katalog & Unit Sewa" />
          <SidebarSubItem path="/rental/bundles" label="Paket Sewa (Bundles)" />
          <SidebarSubItem path="/rental/returns" label="Pengembalian Unit" />
          <SidebarSubItem path="/rental/overdue" label="Pesanan Overdue" />
          <SidebarSubItem path="/rental/settings" label="Pengaturan Rental" />
        </SidebarGroup>
      )}

      {/* 03. Sales Division */}
      <SidebarGroup
        label="Sales"
        icon={<CurrencyDollarIcon />}
        activePrefixes={['/customers', '/quotations', '/sales-orders']}
        defaultPath="/sales-orders"
      >
        <SidebarSubItem path="/customers" label="Customers" />
        <SidebarSubItem path="/quotations" label="Quotations" />
        <SidebarSubItem path="/sales-orders" label="Sales Orders" />
      </SidebarGroup>

      {/* 04. Purchasing Division */}
      <SidebarGroup
        label="Purchasing"
        icon={<ArrowDownTrayIcon />}
        activePrefixes={['/suppliers', '/purchase-orders']}
        defaultPath="/purchase-orders"
      >
        <SidebarSubItem path="/suppliers" label="Suppliers" />
        <SidebarSubItem path="/purchase-orders" label="Purchase Orders" />
      </SidebarGroup>

      {/* 05. Inventory Division */}
      <SidebarGroup
        label="Inventory"
        icon={<CubeIcon />}
        activePrefixes={['/products', '/inventory', '/receipts', '/shipments']}
        defaultPath="/inventory"
      >
        <SidebarSubItem path="/products" label="Products" />
        <SidebarSubItem path="/inventory" label="Stock Levels" />
        <SidebarSubItem path="/receipts" label="Receipts" />
        <SidebarSubItem path="/shipments" label="Deliveries" />
      </SidebarGroup>

      {/* 06. Finance Division */}
      <SidebarGroup
        label="Finance"
        icon={<BanknotesIcon />}
        activePrefixes={['/invoices', '/bills', '/payments', '/cash-bank', '/expenses', '/finance']}
        defaultPath="/invoices"
      >
        <SidebarSubItem path="/invoices" label="Customer Invoices" />
        <SidebarSubItem path="/bills" label="Vendor Bills" />
        <SidebarSubItem path="/payments" label="Payments" />
        <SidebarSubItem path="/cash-bank" label="Cash & Bank" />
        <SidebarSubItem path="/expenses" label="Expenses" />
        <SidebarSubItem path="/finance" label="Journal & Ledger" />
      </SidebarGroup>

      {/* 07. Settings & Integrations */}
      <SidebarGroup
        label="Settings"
        icon={<Cog6ToothIcon />}
        activePrefixes={['/companies', '/settings', '/integrations', '/docs']}
        defaultPath="/companies"
      >
        <SidebarSubItem path="/companies" label="Companies" />
        <SidebarSubItem path="/settings/billing" label="Billing & Paket" />
        <SidebarSubItem path="/settings/payment-methods" label="Metode Pembayaran" />
        <SidebarSubItem path="/integrations" label="Integrations" />
        <SidebarSubItem path="/docs/api" label="API Docs" />
        <SidebarSubItem path="/settings/whatsapp" label="WhatsApp Gateway" />
      </SidebarGroup>
    </nav>
  );
}

