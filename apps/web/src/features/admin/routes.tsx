import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { LazyRoute } from '@/app/LazyRoute';

// Admin pages - lazy loaded
const Observability = lazy(() => import('./pages/Observability'));

export const AdminRoutes = (
  <Route
    path="admin/observability"
    element={
      <LazyRoute>
        <Observability />
      </LazyRoute>
    }
  />
);
