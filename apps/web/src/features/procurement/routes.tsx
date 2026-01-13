import { lazy, Suspense } from 'react';
import { Route } from 'react-router-dom';
import { LoadingState } from '@/components/ui';

// Procurement pages - lazy loaded
const Suppliers = lazy(() => import('./pages/Suppliers'));
const SupplierDetail = lazy(() => import('./pages/SupplierDetail'));
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'));
const PurchaseOrderDetail = lazy(
  () => import('./pages/PurchaseOrderDetail')
);

function LazyRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingState />}>{children}</Suspense>;
}

export const ProcurementRoutes = (
  <>
    <Route
      path="suppliers"
      element={
        <LazyRoute>
          <Suppliers />
        </LazyRoute>
      }
    />
    <Route
      path="suppliers/:id"
      element={
        <LazyRoute>
          <SupplierDetail />
        </LazyRoute>
      }
    />
    <Route
      path="purchase-orders"
      element={
        <LazyRoute>
          <PurchaseOrders />
        </LazyRoute>
      }
    />
    <Route
      path="purchase-orders/:id"
      element={
        <LazyRoute>
          <PurchaseOrderDetail />
        </LazyRoute>
      }
    />
  </>
);
