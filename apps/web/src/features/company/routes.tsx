import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { LazyRoute } from '@/app/LazyRoute';

// Company pages - lazy loaded
const Companies = lazy(() => import('./pages/Companies'));
const CreateCompany = lazy(() => import('./pages/CreateCompany'));
const TeamManagement = lazy(() => import('./pages/TeamManagement'));

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
