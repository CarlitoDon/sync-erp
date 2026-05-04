import { useState, useEffect } from 'react';
import {
  useNavigate,
  Link,
  useSearchParams,
} from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { LoginInput } from '@/types/api';

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
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h2 className="mb-6 text-2xl font-bold text-gray-900">
          Sign In
        </h2>

        {error && (
          <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {notice && (
          <div className="mb-4 rounded bg-green-50 p-3 text-sm text-green-700">
            {notice}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full rounded border p-2 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              name="password"
              required
              value={formData.password}
              onChange={handleChange}
              className="w-full rounded border p-2 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-600 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Please wait...' : 'Sign In'}
          </button>

          <button
            type="button"
            onClick={loginWithGoogle}
            disabled={loading || isResending}
            className="w-full rounded border border-gray-300 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Continue with Google
          </button>
        </form>

        {error === EMAIL_NOT_VERIFIED_MESSAGE && formData.email && (
          <button
            type="button"
            onClick={handleResendVerification}
            disabled={isResending}
            className="mt-4 w-full rounded border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {isResending
              ? 'Sending verification link...'
              : 'Resend verification email'}
          </button>
        )}

        <p className="mt-4 text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <Link
            to="/register"
            className="text-blue-600 hover:text-blue-500"
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
