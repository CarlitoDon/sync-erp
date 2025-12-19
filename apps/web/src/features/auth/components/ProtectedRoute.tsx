import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';

interface ProtectedRouteProps {
  requireCompany?: boolean;
}

export const ProtectedRoute = ({
  requireCompany = true,
}: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { currentCompany, isLoading: companyLoading } = useCompany();
  const location = useLocation();

  if (authLoading || companyLoading) {
    // improved loading state could go here (e.g. global spinner)
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login, but save the location they were trying to go to
    return (
      <Navigate to="/login" state={{ from: location }} replace />
    );
  }

  // If company is required but not selected, redirect to selection page
  // BUT avoid redirect loops if we are already on that page (checked via route config usually, but here via render logic)
  if (requireCompany && !currentCompany) {
    return <Navigate to="/select-company" replace />;
  }

  return <Outlet />;
};
