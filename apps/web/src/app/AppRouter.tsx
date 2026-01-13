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

// Feature Routes
import { RentalRoutes } from '@/features/rental/routes';
import { SalesRoutes } from '@/features/sales/routes';
import { ProcurementRoutes } from '@/features/procurement/routes';
import { InventoryRoutes } from '@/features/inventory/routes';
import { AccountingRoutes } from '@/features/accounting/routes';
import { CompanyRoutes } from '@/features/company/routes';
import { AdminRoutes } from '@/features/admin/routes';

// Lazy loaded pages for root level
const CompanySelectionPage = lazy(() =>
  import('@/features/company/pages/CompanySelectionPage').then(
    (m) => ({ default: m.CompanySelectionPage })
  )
);
const CashBankPage = lazy(() => import('@/features/cash-bank'));

/**
 * Suspense wrapper for lazy-loaded routes.
 * Shows loading spinner while chunks are being fetched.
 */
function LazyRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingState />}>{children}</Suspense>;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute requireCompany={false} />}>
        <Route
          path="/select-company"
          element={
            <LazyRoute>
              <CompanySelectionPage />
            </LazyRoute>
          }
        />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />

          {/* Feature Routes */}
          {CompanyRoutes}
          {ProcurementRoutes}
          {SalesRoutes}
          {InventoryRoutes}
          {RentalRoutes}
          {AccountingRoutes}
          {AdminRoutes}

          {/* Remaining miscellaneous routes */}
          <Route
            path="cash-bank"
            element={
              <LazyRoute>
                <CashBankPage />
              </LazyRoute>
            }
          />
        </Route>
      </Route>
    </Routes>
  );
}
