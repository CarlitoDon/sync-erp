import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { LazyRoute } from '@/app/LazyRoute';

// Sales pages - lazy loaded
const Customers = lazy(() => import('./pages/Customers'));
const CustomerDetail = lazy(() => import('./pages/CustomerDetail'));
const SalesOrders = lazy(() => import('./pages/SalesOrders'));
const SalesOrderDetail = lazy(
  () => import('./pages/SalesOrderDetail')
);
const Quotations = lazy(() => import('./pages/Quotations'));

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
