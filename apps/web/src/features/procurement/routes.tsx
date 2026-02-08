import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { LazyRoute } from '@/app/LazyRoute';

// Procurement pages - lazy loaded
const Suppliers = lazy(() => import('./pages/Suppliers'));
const SupplierDetail = lazy(() => import('./pages/SupplierDetail'));
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'));
const PurchaseOrderDetail = lazy(
  () => import('./pages/PurchaseOrderDetail')
);

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
