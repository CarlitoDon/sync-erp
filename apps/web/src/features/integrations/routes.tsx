import { lazy, Suspense } from 'react';
import { Route } from 'react-router-dom';
import { LoadingState } from '@/components/ui';

// Lazy load integration pages
const IntegrationsListPage = lazy(
  () => import('./pages/IntegrationsListPage')
);
const IntegrationDetailPage = lazy(
  () => import('./pages/IntegrationDetailPage')
);

function LazyRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingState />}>{children}</Suspense>;
}

export const IntegrationRoutes = (
  <>
    <Route
      path="/integrations"
      element={
        <LazyRoute>
          <IntegrationsListPage />
        </LazyRoute>
      }
    />
    {/* Detail route will be added in Phase 4 */}
    <Route
      path="/integrations/:id"
      element={
        <LazyRoute>
          <IntegrationDetailPage />
        </LazyRoute>
      }
    />
  </>
);
