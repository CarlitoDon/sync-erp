import { lazy, Suspense } from 'react';
import { Route } from 'react-router-dom';
import { LoadingState } from '@/components/ui';

// Admin pages - lazy loaded
const Observability = lazy(() => import('./pages/Observability'));

function LazyRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingState />}>{children}</Suspense>;
}

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
