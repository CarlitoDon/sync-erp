import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { LazyRoute } from '@/app/LazyRoute';

// Inventory pages - lazy loaded
const Products = lazy(() => import('./pages/Products'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Inventory = lazy(() => import('./pages/Inventory'));
const GoodsReceipts = lazy(() => import('./pages/GoodsReceipts'));
const GoodsReceiptDetail = lazy(
  () => import('./pages/GoodsReceiptDetail')
);
const Shipments = lazy(() => import('./pages/Shipments'));
const ShipmentDetail = lazy(() => import('./pages/ShipmentDetail'));

export const InventoryRoutes = (
  <>
    <Route
      path="products"
      element={
        <LazyRoute>
          <Products />
        </LazyRoute>
      }
    />
    <Route
      path="products/:id"
      element={
        <LazyRoute>
          <ProductDetail />
        </LazyRoute>
      }
    />
    <Route
      path="inventory"
      element={
        <LazyRoute>
          <Inventory />
        </LazyRoute>
      }
    />
    <Route
      path="receipts"
      element={
        <LazyRoute>
          <GoodsReceipts />
        </LazyRoute>
      }
    />
    <Route
      path="receipts/:id"
      element={
        <LazyRoute>
          <GoodsReceiptDetail />
        </LazyRoute>
      }
    />
    <Route
      path="shipments"
      element={
        <LazyRoute>
          <Shipments />
        </LazyRoute>
      }
    />
    <Route
      path="shipments/:id"
      element={
        <LazyRoute>
          <ShipmentDetail />
        </LazyRoute>
      }
    />
  </>
);
