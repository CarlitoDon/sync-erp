import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { LoadingState } from '@/components/ui';
import { Suspense } from 'react';

// Lazy loaded pages
const RentalItems = lazy(() => import('./pages/RentalItemsPage'));
const RentalBundles = lazy(() => import('./pages/RentalBundlesPage'));
const RentalOrders = lazy(() => import('./pages/RentalOrdersPage'));
const RentalOrderDetail = lazy(
  () => import('./pages/RentalOrderDetail')
);
const RentalReturns = lazy(() => import('./pages/ReturnsPage'));
const RentalOverdue = lazy(() => import('./pages/OverduePage'));
const RentalSettings = lazy(
  () => import('./pages/RentalSettingsPage')
);
const RentalScheduler = lazy(
  () => import('./pages/RentalSchedulerPage')
);

function LazyRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingState />}>{children}</Suspense>;
}

export const RentalRoutes = (
  <Route path="rental">
    <Route
      path="items"
      element={
        <LazyRoute>
          <RentalItems />
        </LazyRoute>
      }
    />
    <Route
      path="bundles"
      element={
        <LazyRoute>
          <RentalBundles />
        </LazyRoute>
      }
    />
    <Route
      path="orders"
      element={
        <LazyRoute>
          <RentalOrders />
        </LazyRoute>
      }
    />
    <Route
      path="orders/:id"
      element={
        <LazyRoute>
          <RentalOrderDetail />
        </LazyRoute>
      }
    />
    <Route
      path="orders/:id/release"
      element={
        <LazyRoute>
          <RentalOrders />
        </LazyRoute>
      }
    />
    <Route
      path="returns"
      element={
        <LazyRoute>
          <RentalReturns />
        </LazyRoute>
      }
    />
    <Route
      path="overdue"
      element={
        <LazyRoute>
          <RentalOverdue />
        </LazyRoute>
      }
    />
    <Route
      path="settings"
      element={
        <LazyRoute>
          <RentalSettings />
        </LazyRoute>
      }
    />
    <Route
      path="scheduler"
      element={
        <LazyRoute>
          <RentalScheduler />
        </LazyRoute>
      }
    />
  </Route>
);
