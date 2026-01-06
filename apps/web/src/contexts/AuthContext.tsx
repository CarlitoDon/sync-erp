import { createContext, useContext, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import type { User, LoginInput, RegisterInput } from '@/types/api';
import { trpc } from '@/lib/trpc';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginInput) => Promise<void>;
  register: (payload: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

// Public routes that don't need auth check
const PUBLIC_ROUTES = ['/login', '/register'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const utils = trpc.useUtils();
  const location = useLocation();

  // Skip auth.me fetch on public routes to avoid unnecessary 401
  const isPublicRoute = PUBLIC_ROUTES.includes(location.pathname);

  const {
    data: user,
    isLoading,
    refetch: checkAuth,
  } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: !isPublicRoute, // Don't fetch on login/register pages
  });

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
    },
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      localStorage.removeItem('currentCompanyId');
    },
  });

  const login = async (payload: LoginInput) => {
    await loginMutation.mutateAsync(payload);
  };

  const register = async (payload: RegisterInput) => {
    await registerMutation.mutateAsync(payload);
  };

  const logout = async () => {
    // Backend reads sessionId from cookie
    await logoutMutation.mutateAsync();
  };

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        checkAuth: async () => {
          await checkAuth();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
