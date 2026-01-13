import { lazy, Suspense } from 'react';
import { Route } from 'react-router-dom';
import { LoadingState } from '@/components/ui';

// Company pages - lazy loaded
const Companies = lazy(() => import('./pages/Companies'));
const CreateCompany = lazy(() => import('./pages/CreateCompany'));
const TeamManagement = lazy(() => import('./pages/TeamManagement'));

function LazyRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingState />}>{children}</Suspense>;
}

export const CompanyRoutes = (
  <>
    <Route
      path="companies"
      element={
        <LazyRoute>
          <Companies />
        </LazyRoute>
      }
    />
    <Route
      path="companies/new"
      element={
        <LazyRoute>
          <CreateCompany />
        </LazyRoute>
      }
    />
    <Route
      path="team"
      element={
        <LazyRoute>
          <TeamManagement />
        </LazyRoute>
      }
    />
  </>
);
