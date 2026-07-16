import { Navigate, Routes, Route } from 'react-router-dom';
import { lazy } from 'react';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import Layout from '@/components/layout/Layout';
import { LazyRoute } from '@/app/LazyRoute';
import MarketingHomePage from '@/features/marketing/pages/MarketingHomePage';
<<<<<<< HEAD
import LegalPage from '@/features/legal/pages/LegalPage';
=======
>>>>>>> origin/dev

// Auth pages - not lazy loaded (initial entry points)
import { RegisterPage } from '@/features/auth/components/RegisterPage';
import { LoginPage } from '@/features/auth/components/LoginPage';
import { VerifyEmailPage } from '@/features/auth/components/VerifyEmailPage';

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
import { SettingsRoutes } from '@/features/settings/routes';
import { IntegrationRoutes } from '@/features/integrations/routes';

// Lazy loaded pages for root level
const CompanySelectionPage = lazy(() =>
  import('@/features/company/pages/CompanySelectionPage').then(
    (m) => ({ default: m.CompanySelectionPage })
  )
);
const OnboardingPage = lazy(() =>
  import('@/features/onboarding/pages/OnboardingPage').then((m) => ({
    default: m.default,
  }))
);
const CashBankPage = lazy(() => import('@/features/cash-bank'));

<<<<<<< HEAD
const APP_HOSTNAMES = new Set([
  'app.sync-erp.com',
  'sync-erp-app.vercel.app',
]);
=======
const APP_HOSTNAMES = new Set(['sync-erp-app.vercel.app']);
>>>>>>> origin/dev

function RootRoute() {
  if (
    typeof window !== 'undefined' &&
    APP_HOSTNAMES.has(window.location.hostname)
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  return <MarketingHomePage />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
<<<<<<< HEAD
      <Route path="/privacy" element={<LegalPage type="privacy" />} />
      <Route path="/terms" element={<LegalPage type="terms" />} />
=======
>>>>>>> origin/dev
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

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
        <Route
          path="/onboarding"
          element={
            <LazyRoute>
              <OnboardingPage />
            </LazyRoute>
          }
        />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Feature Routes */}
          {CompanyRoutes}
          {ProcurementRoutes}
          {SalesRoutes}
          {InventoryRoutes}
          {RentalRoutes}
          {AccountingRoutes}
          {AdminRoutes}
          {SettingsRoutes}
          {IntegrationRoutes}

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
