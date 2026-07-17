import {
  createContext,
  useContext,
  ReactNode,
  useEffect,
  useState,
} from 'react';
import type {
  User,
  LoginInput,
  RegisterInput,
  RegisterResult,
  ResendVerificationInput,
  ResendVerificationResult,
} from '@/types/api';
import { trpc } from '@/lib/trpc';

type GoogleAuthIntent = 'login' | 'register';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginInput) => Promise<void>;
  register: (
    payload: RegisterInput
  ) => Promise<RegisterResult>;
  resendVerification: (
    payload: ResendVerificationInput
  ) => Promise<ResendVerificationResult>;
  loginWithGoogle: () => void;
  registerWithGoogle: () => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const utils = trpc.useUtils();
  const apiBaseUrl = getApiBaseUrl();
  const {
    data: sessionUser,
    error,
    isLoading: isSessionLoading,
    refetch,
  } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (sessionUser) {
      setUser(sessionUser);
    }
  }, [sessionUser]);

  useEffect(() => {
    if (error) {
      setUser(null);
    }
  }, [error]);

  const effectiveUser = user ?? sessionUser ?? null;

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      setUser(data.user);
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
      setUser(null);
      utils.auth.me.setData(undefined, null);
      utils.auth.me.invalidate();
      localStorage.removeItem('currentCompanyId');
    },
  });

  const resendVerificationMutation =
    trpc.auth.resendVerification.useMutation();

  const login = async (payload: LoginInput) => {
    await loginMutation.mutateAsync(payload);
  };

  const register = async (payload: RegisterInput) => {
    return registerMutation.mutateAsync(payload);
  };

  const resendVerification = async (
    payload: ResendVerificationInput
  ) => {
    return resendVerificationMutation.mutateAsync(payload);
  };

  const startGoogleAuth = (intent: GoogleAuthIntent) => {
    window.location.assign(
      `${apiBaseUrl}/auth/google/start?intent=${intent}`
    );
  };

  const logout = async () => {
    // Backend reads sessionId from cookie
    await logoutMutation.mutateAsync();
  };

  return (
    <AuthContext.Provider
      value={{
        user: effectiveUser,
        isAuthenticated: !!effectiveUser,
        isLoading: isSessionLoading && !effectiveUser,
        login,
        register,
        resendVerification,
        loginWithGoogle: () => startGoogleAuth('login'),
        registerWithGoogle: () => startGoogleAuth('register'),
        logout,
        checkAuth: async () => {
          const result = await refetch();
          if (result.error) {
            setUser(null);
            return;
          }
          setUser(result.data ?? null);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function getApiBaseUrl() {
  const configuredUrl =
    import.meta.env.VITE_SYNC_ERP_API_URL ||
    'http://localhost:3001/api/trpc';

  const normalizedUrl = configuredUrl
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api\/trpc$/, '/api')
    .replace(/\/trpc$/, '');

  return normalizedUrl.endsWith('/api')
    ? normalizedUrl
    : `${normalizedUrl}/api`;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
