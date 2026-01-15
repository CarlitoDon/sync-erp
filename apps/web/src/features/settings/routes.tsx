import { lazy, Suspense } from 'react';
import { Route } from 'react-router-dom';
import { LoadingState } from '@/components/ui';

// Settings pages - lazy loaded
const ApiKeysPage = lazy(() => import('./pages/ApiKeysPage'));

function LazyRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingState />}>{children}</Suspense>;
}

export const SettingsRoutes = (
  <>
    <Route
      path="settings/api-keys"
      element={
        <LazyRoute>
          <ApiKeysPage />
        </LazyRoute>
      }
    />
  </>
);
