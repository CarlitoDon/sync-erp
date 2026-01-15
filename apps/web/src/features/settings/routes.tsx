import { lazy, Suspense } from 'react';
import { Route } from 'react-router-dom';
import { LoadingState } from '@/components/ui';

// Settings pages - lazy loaded
const ApiKeysPage = lazy(() => import('./pages/ApiKeysPage'));
const ApiKeyDetailPage = lazy(
  () => import('./pages/ApiKeyDetailPage')
);
const ApiDocsPage = lazy(() => import('./pages/ApiDocsPage'));
const WhatsAppSettingsPage = lazy(() =>
  import('./pages/WhatsAppSettingsPage').then((m) => ({
    default: m.WhatsAppSettingsPage,
  }))
);

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
    <Route
      path="settings/api-keys/:id"
      element={
        <LazyRoute>
          <ApiKeyDetailPage />
        </LazyRoute>
      }
    />
    <Route
      path="settings/whatsapp"
      element={
        <LazyRoute>
          <WhatsAppSettingsPage />
        </LazyRoute>
      }
    />
    <Route
      path="docs/api"
      element={
        <LazyRoute>
          <ApiDocsPage />
        </LazyRoute>
      }
    />
  </>
);
