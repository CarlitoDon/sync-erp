import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { LazyRoute } from '@/app/LazyRoute';

// Lazy load integration pages
const IntegrationsListPage = lazy(
  () => import('./pages/IntegrationsListPage')
);
const IntegrationDetailPage = lazy(
  () => import('./pages/IntegrationDetailPage')
);

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
