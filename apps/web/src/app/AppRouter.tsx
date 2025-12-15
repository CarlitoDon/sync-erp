import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../features/auth/components/ProtectedRoute';
import Layout from '../components/layout/Layout';
import Dashboard from '../features/dashboard/pages/Dashboard';
import Companies from '../features/company/pages/Companies';
import CreateCompany from '../features/company/pages/CreateCompany';
import Suppliers from '../features/procurement/pages/Suppliers';
import Customers from '../features/sales/pages/Customers';
import Products from '../features/inventory/pages/Products';
import PurchaseOrders from '../features/procurement/pages/PurchaseOrders';
import PurchaseOrderDetail from '../features/procurement/pages/PurchaseOrderDetail';
import Inventory from '../features/inventory/pages/Inventory';
import SalesOrders from '../features/sales/pages/SalesOrders';
import SalesOrderDetail from '../features/sales/pages/SalesOrderDetail';
import Invoices from '../features/finance/pages/Invoices';
import InvoiceDetail from '../features/finance/pages/InvoiceDetail';
import AccountsPayable from '../features/finance/pages/AccountsPayable';
import BillDetail from '../features/finance/pages/BillDetail';
import TeamManagement from '../features/company/pages/TeamManagement';
import Finance from '../features/finance/pages/Finance';
import { RegisterPage } from '../features/auth/components/RegisterPage';
import { LoginPage } from '../features/auth/components/LoginPage';
import { CompanySelectionPage } from '../features/company/pages/CompanySelectionPage';

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
          <Route path="customers" element={<Customers />} />
          <Route path="products" element={<Products />} />
          <Route path="purchase-orders" element={<PurchaseOrders />} />
          <Route path="purchase-orders/:id" element={<PurchaseOrderDetail />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="sales-orders" element={<SalesOrders />} />
          <Route path="sales-orders/:id" element={<SalesOrderDetail />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="invoices/:id" element={<InvoiceDetail />} />
          <Route path="bills" element={<AccountsPayable />} />
          <Route path="bills/:id" element={<BillDetail />} />
          <Route path="finance" element={<Finance />} />
          <Route path="team" element={<TeamManagement />} />
        </Route>
      </Route>
    </Routes>
  );
}
