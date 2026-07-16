import { useState, useEffect } from 'react';
import {
  useNavigate,
  Link,
  useSearchParams,
} from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { LoginInput } from '@/types/api';
import { BrandMark } from '@/components/brand/BrandMark';
import { Button, Input } from '@/components/ui';

const EMAIL_NOT_VERIFIED_MESSAGE =
  'Please verify your email before signing in.';

const EMAIL_NOT_VERIFIED_MESSAGE =
  'Please verify your email before signing in.';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    login,
    resendVerification,
    loginWithGoogle,
    isAuthenticated,
    isLoading,
  } = useAuth();
  const [formData, setFormData] = useState<LoginInput>({
    email: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Redirect to select-company if already logged in (uses cached auth data)
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/select-company', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  useEffect(() => {
    const authError = searchParams.get('authError');
    if (!authError) {
      return;
    }

    setError(getGoogleOAuthErrorMessage(authError));
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      await login(formData);
      // Success
      navigate('/select-company');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleResendVerification = async () => {
    setError(null);
    setNotice(null);
    setIsResending(true);

    try {
      await resendVerification({
        email: formData.email.trim().toLowerCase(),
      });
      setNotice(
        'If your account exists and is still unverified, a fresh verification link has been sent.'
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to resend verification email';
      setError(message);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="auth-grid-background flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-xl shadow-slate-300/40">
        <div className="mb-7 flex items-center gap-3">
          <BrandMark />
          <div>
            <p className="text-sm font-medium text-slate-500">
              Sync ERP
            </p>
            <h2 className="text-2xl font-bold text-slate-950">
              Sign In
            </h2>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {notice && (
          <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {notice}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            name="email"
            required
            value={formData.email}
            onChange={handleChange}
          />

          <Input
            label="Password"
            type="password"
            name="password"
            required
            value={formData.password}
            onChange={handleChange}
          />

          <Button
            type="submit"
            className="w-full"
            isLoading={loading}
            loadingText="Please wait..."
            disabled={loading}
          >
            Sign In
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={loginWithGoogle}
            disabled={loading || isResending}
            className="w-full"
          >
            Continue with Google
          </Button>
        </form>

        {error === EMAIL_NOT_VERIFIED_MESSAGE && formData.email && (
          <Button
            type="button"
            variant="outline"
            onClick={handleResendVerification}
            isLoading={isResending}
            loadingText="Sending verification link..."
            className="mt-4 w-full"
          >
            Resend verification email
          </Button>
        )}

        <p className="mt-4 text-center text-sm text-slate-600">
          Don't have an account?{' '}
          <Link
            to="/register"
            className="font-medium text-cyan-700 hover:text-cyan-900"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};

function getGoogleOAuthErrorMessage(errorCode: string) {
  switch (errorCode) {
    case 'google_oauth_not_configured':
      return 'Google sign-in is not configured yet.';
    case 'google_oauth_cancelled':
      return 'Google sign-in was cancelled before completion.';
    case 'google_email_not_verified':
      return 'Your Google account email must be verified before signing in.';
    case 'google_account_link_conflict':
      return 'This email is already linked to a different Google account.';
    default:
      return 'We could not complete Google sign-in. Please try again.';
  }
}
