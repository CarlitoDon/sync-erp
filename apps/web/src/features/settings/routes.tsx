import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { LazyRoute } from '@/app/LazyRoute';

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
const PaymentMethodsPage = lazy(
  () => import('./pages/PaymentMethodsPage')
);

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
    <Route
      path="settings/payment-methods"
      element={
        <LazyRoute>
          <PaymentMethodsPage />
        </LazyRoute>
      }
    />
  </>
);
