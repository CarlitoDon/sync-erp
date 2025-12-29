import { Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import Layout from '@/components/layout/Layout';
import { LoadingState } from '@/components/ui';

// Auth pages - not lazy loaded (initial entry points)
import { RegisterPage } from '@/features/auth/components/RegisterPage';
import { LoginPage } from '@/features/auth/components/LoginPage';

// Dashboard - not lazy (landing page after login)
import Dashboard from '@/features/dashboard/pages/Dashboard';

// Company pages - lazy loaded
const Companies = lazy(() => import('@/features/company/pages/Companies'));
const CreateCompany = lazy(() => import('@/features/company/pages/CreateCompany'));
const CompanySelectionPage = lazy(() => import('@/features/company/pages/CompanySelectionPage').then(m => ({ default: m.CompanySelectionPage })));
const TeamManagement = lazy(() => import('@/features/company/pages/TeamManagement'));

// Procurement pages - lazy loaded
const Suppliers = lazy(() => import('@/features/procurement/pages/Suppliers'));
const SupplierDetail = lazy(() => import('@/features/procurement/pages/SupplierDetail'));
const PurchaseOrders = lazy(() => import('@/features/procurement/pages/PurchaseOrders'));
const PurchaseOrderDetail = lazy(() => import('@/features/procurement/pages/PurchaseOrderDetail'));

// Sales pages - lazy loaded
const Customers = lazy(() => import('@/features/sales/pages/Customers'));
const CustomerDetail = lazy(() => import('@/features/sales/pages/CustomerDetail'));
const SalesOrders = lazy(() => import('@/features/sales/pages/SalesOrders'));
const SalesOrderDetail = lazy(() => import('@/features/sales/pages/SalesOrderDetail'));
const Quotations = lazy(() => import('@/features/sales/pages/Quotations'));

// Inventory pages - lazy loaded
const Products = lazy(() => import('@/features/inventory/pages/Products'));
const ProductDetail = lazy(() => import('@/features/inventory/pages/ProductDetail'));
const Inventory = lazy(() => import('@/features/inventory/pages/Inventory'));
const GoodsReceipts = lazy(() => import('@/features/inventory/pages/GoodsReceipts'));
const GoodsReceiptDetail = lazy(() => import('@/features/inventory/pages/GoodsReceiptDetail'));
const Shipments = lazy(() => import('@/features/inventory/pages/Shipments'));
const ShipmentDetail = lazy(() => import('@/features/inventory/pages/ShipmentDetail'));

// Accounting pages - lazy loaded
const Finance = lazy(() => import('@/features/accounting/pages/Finance'));
const Invoices = lazy(() => import('@/features/accounting/pages/Invoices'));
const InvoiceDetail = lazy(() => import('@/features/accounting/pages/InvoiceDetail'));
const AccountsPayable = lazy(() => import('@/features/accounting/pages/AccountsPayable'));
const BillDetail = lazy(() => import('@/features/accounting/components/BillDetail'));
const Payments = lazy(() => import('@/features/accounting/pages/Payments'));
const PaymentDetail = lazy(() => import('@/features/accounting/pages/PaymentDetail'));
const ExpenseList = lazy(() => import('@/features/accounting/pages/ExpenseList'));
const ExpenseForm = lazy(() => import('@/features/accounting/pages/ExpenseForm'));
const ExpenseDetail = lazy(() => import('@/features/accounting/pages/ExpenseDetail'));
const JournalEntries = lazy(() => import('@/features/accounting/pages/JournalEntries'));
const JournalDetail = lazy(() => import('@/features/accounting/pages/JournalDetail'));

// Admin pages - lazy loaded
const Observability = lazy(() => import('@/features/admin/pages/Observability'));

/**
 * Suspense wrapper for lazy-loaded routes.
 * Shows loading spinner while chunks are being fetched.
 */
function LazyRoute({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingState />}>
      {children}
    </Suspense>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute requireCompany={false} />}>
        <Route
          path="/select-company"
          element={<LazyRoute><CompanySelectionPage /></LazyRoute>}
        />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="companies" element={<LazyRoute><Companies /></LazyRoute>} />
          <Route path="companies/new" element={<LazyRoute><CreateCompany /></LazyRoute>} />
          <Route path="suppliers" element={<LazyRoute><Suppliers /></LazyRoute>} />
          <Route path="suppliers/:id" element={<LazyRoute><SupplierDetail /></LazyRoute>} />
          <Route path="customers" element={<LazyRoute><Customers /></LazyRoute>} />
          <Route path="customers/:id" element={<LazyRoute><CustomerDetail /></LazyRoute>} />
          <Route path="products" element={<LazyRoute><Products /></LazyRoute>} />
          <Route path="products/:id" element={<LazyRoute><ProductDetail /></LazyRoute>} />
          <Route
            path="purchase-orders"
            element={<LazyRoute><PurchaseOrders /></LazyRoute>}
          />
          <Route
            path="purchase-orders/:id"
            element={<LazyRoute><PurchaseOrderDetail /></LazyRoute>}
          />
          <Route path="inventory" element={<LazyRoute><Inventory /></LazyRoute>} />
          <Route path="receipts" element={<LazyRoute><GoodsReceipts /></LazyRoute>} />
          <Route
            path="receipts/:id"
            element={<LazyRoute><GoodsReceiptDetail /></LazyRoute>}
          />
          <Route path="shipments" element={<LazyRoute><Shipments /></LazyRoute>} />
          <Route path="shipments/:id" element={<LazyRoute><ShipmentDetail /></LazyRoute>} />
          <Route path="sales-orders" element={<LazyRoute><SalesOrders /></LazyRoute>} />
          <Route
            path="sales-orders/:id"
            element={<LazyRoute><SalesOrderDetail /></LazyRoute>}
          />
          <Route path="quotations" element={<LazyRoute><Quotations /></LazyRoute>} />
          <Route path="invoices" element={<LazyRoute><Invoices /></LazyRoute>} />
          <Route path="invoices/:id" element={<LazyRoute><InvoiceDetail /></LazyRoute>} />
          <Route path="expenses" element={<LazyRoute><ExpenseList /></LazyRoute>} />
          <Route path="expenses/new" element={<LazyRoute><ExpenseForm /></LazyRoute>} />
          <Route path="expenses/:id" element={<LazyRoute><ExpenseDetail /></LazyRoute>} />
          <Route path="bills" element={<LazyRoute><AccountsPayable /></LazyRoute>} />
          <Route path="bills/:id" element={<LazyRoute><BillDetail /></LazyRoute>} />
          <Route path="finance" element={<LazyRoute><Finance /></LazyRoute>} />
          <Route path="payments" element={<LazyRoute><Payments /></LazyRoute>} />
          <Route path="payments/:id" element={<LazyRoute><PaymentDetail /></LazyRoute>} />
          <Route path="journals" element={<LazyRoute><JournalEntries /></LazyRoute>} />
          <Route path="journals/:id" element={<LazyRoute><JournalDetail /></LazyRoute>} />
          <Route path="team" element={<LazyRoute><TeamManagement /></LazyRoute>} />
          {/* Admin Observability (US5 - FR-014, FR-015, FR-016) */}
          <Route
            path="admin/observability"
            element={<LazyRoute><Observability /></LazyRoute>}
          />
        </Route>
      </Route>
    </Routes>
  );
}
