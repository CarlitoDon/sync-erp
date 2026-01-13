import { lazy, Suspense } from 'react';
import { Route } from 'react-router-dom';
import { LoadingState } from '@/components/ui';

// Sales pages - lazy loaded
const Customers = lazy(() => import('./pages/Customers'));
const CustomerDetail = lazy(() => import('./pages/CustomerDetail'));
const SalesOrders = lazy(() => import('./pages/SalesOrders'));
const SalesOrderDetail = lazy(
  () => import('./pages/SalesOrderDetail')
);
const Quotations = lazy(() => import('./pages/Quotations'));

function LazyRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingState />}>{children}</Suspense>;
}

export const SalesRoutes = (
  <>
    <Route
      path="customers"
      element={
        <LazyRoute>
          <Customers />
        </LazyRoute>
      }
    />
    <Route
      path="customers/:id"
      element={
        <LazyRoute>
          <CustomerDetail />
        </LazyRoute>
      }
    />
    <Route
      path="sales-orders"
      element={
        <LazyRoute>
          <SalesOrders />
        </LazyRoute>
      }
    />
    <Route
      path="sales-orders/:id"
      element={
        <LazyRoute>
          <SalesOrderDetail />
        </LazyRoute>
      }
    />
    <Route
      path="quotations"
      element={
        <LazyRoute>
          <Quotations />
        </LazyRoute>
      }
    />
  </>
);
