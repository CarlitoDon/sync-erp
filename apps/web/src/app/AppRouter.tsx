import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import Layout from '@/components/layout/Layout';
import Dashboard from '@/features/dashboard/pages/Dashboard';
import Companies from '@/features/company/pages/Companies';
import CreateCompany from '@/features/company/pages/CreateCompany';
import Suppliers from '@/features/procurement/pages/Suppliers';
import Customers from '@/features/sales/pages/Customers';
import Products from '@/features/inventory/pages/Products';
import PurchaseOrders from '@/features/procurement/pages/PurchaseOrders';
import PurchaseOrderDetail from '@/features/procurement/pages/PurchaseOrderDetail';
import Inventory from '@/features/inventory/pages/Inventory';
import GoodsReceipts from '@/features/inventory/pages/GoodsReceipts';
import GoodsReceiptDetail from '@/features/inventory/pages/GoodsReceiptDetail';
import Shipments from '@/features/inventory/pages/Shipments';
import ShipmentDetail from '@/features/inventory/pages/ShipmentDetail';
import SalesOrders from '@/features/sales/pages/SalesOrders';
import SalesOrderDetail from '@/features/sales/pages/SalesOrderDetail';
import Invoices from '@/features/accounting/pages/Invoices';
import InvoiceDetail from '@/features/accounting/pages/InvoiceDetail';
import AccountsPayable from '@/features/accounting/pages/AccountsPayable';
import BillDetail from '@/features/accounting/components/BillDetail';
import PaymentDetail from '@/features/accounting/pages/PaymentDetail';

import TeamManagement from '@/features/company/pages/TeamManagement';
import Finance from '@/features/accounting/pages/Finance';
import { RegisterPage } from '@/features/auth/components/RegisterPage';
import { LoginPage } from '@/features/auth/components/LoginPage';
import { CompanySelectionPage } from '@/features/company/pages/CompanySelectionPage';
import CustomerDetail from '@/features/sales/pages/CustomerDetail';
import SupplierDetail from '@/features/procurement/pages/SupplierDetail';
import ProductDetail from '@/features/inventory/pages/ProductDetail';
import JournalDetail from '@/features/accounting/pages/JournalDetail';
import JournalEntries from '@/features/accounting/pages/JournalEntries';
import Observability from '@/features/admin/pages/Observability';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute requireCompany={false} />}>
        <Route
          path="/select-company"
          element={<CompanySelectionPage />}
        />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="companies" element={<Companies />} />
          <Route path="companies/new" element={<CreateCompany />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="suppliers/:id" element={<SupplierDetail />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="products" element={<Products />} />
          <Route path="products/:id" element={<ProductDetail />} />
          <Route
            path="purchase-orders"
            element={<PurchaseOrders />}
          />
          <Route
            path="purchase-orders/:id"
            element={<PurchaseOrderDetail />}
          />
          <Route path="inventory" element={<Inventory />} />
          <Route path="receipts" element={<GoodsReceipts />} />
          <Route
            path="receipts/:id"
            element={<GoodsReceiptDetail />}
          />
          <Route path="shipments" element={<Shipments />} />
          <Route path="shipments/:id" element={<ShipmentDetail />} />
          <Route path="sales-orders" element={<SalesOrders />} />
          <Route
            path="sales-orders/:id"
            element={<SalesOrderDetail />}
          />
          <Route path="invoices" element={<Invoices />} />
          <Route path="invoices/:id" element={<InvoiceDetail />} />
          <Route path="bills" element={<AccountsPayable />} />

          <Route path="bills/:id" element={<BillDetail />} />
          <Route path="finance" element={<Finance />} />
          <Route path="payments/:id" element={<PaymentDetail />} />
          <Route path="journals" element={<JournalEntries />} />
          <Route path="journals/:id" element={<JournalDetail />} />
          <Route path="team" element={<TeamManagement />} />
          {/* Admin Observability (US5 - FR-014, FR-015, FR-016) */}
          <Route
            path="admin/observability"
            element={<Observability />}
          />
        </Route>
      </Route>
    </Routes>
  );
}
