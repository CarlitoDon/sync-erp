import { useEffect, useMemo, useState } from 'react';
import {
  useNavigate,
  Link,
  useSearchParams,
} from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { RegisterInput } from '@/types/api';

interface RegisterFormState extends RegisterInput {
  confirmPassword: string;
}

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    register,
    resendVerification,
    registerWithGoogle,
    isAuthenticated,
    isLoading,
  } = useAuth();
  const [formData, setFormData] = useState<RegisterFormState>({
    email: '',
    name: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [successState, setSuccessState] = useState<{
    email: string;
    verificationUrl?: string;
  } | null>(null);

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

  const passwordChecks = useMemo(
    () => ({
      minLength: formData.password.length >= 8,
      hasLetter: /[A-Za-z]/.test(formData.password),
      hasNumber: /\d/.test(formData.password),
    }),
    [formData.password]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const normalizedName = formData.name.trim().replace(/\s+/g, ' ');
    const normalizedEmail = formData.email.trim().toLowerCase();

    if (normalizedName.length < 2) {
      setError('Name must be at least 2 characters.');
      return;
    }

    if (
      !passwordChecks.minLength ||
      !passwordChecks.hasLetter ||
      !passwordChecks.hasNumber
    ) {
      setError(
        'Password must be at least 8 characters and include letters and numbers.'
      );
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Password confirmation does not match.');
      return;
    }

    setLoading(true);

    try {
      const result = await register({
        email: normalizedEmail,
        name: normalizedName,
        password: formData.password,
      });
      setSuccessState({
        email: result.verificationSentTo || normalizedEmail,
        verificationUrl: result.verificationUrl || undefined,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Registration failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleResendVerification = async () => {
    if (!successState) return;

    setError(null);
    setNotice(null);
    setIsResending(true);

    try {
      const result = await resendVerification({
        email: successState.email,
      });
      setSuccessState((current) =>
        current
          ? {
              ...current,
              verificationUrl:
                result.verificationUrl || current.verificationUrl,
            }
          : current
      );
      setNotice(
        'A new verification link has been issued. Please check your email inbox.'
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

  if (successState) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
          <h2 className="mb-3 text-2xl font-bold text-gray-900">
            Verify Your Email
          </h2>
          <p className="mb-4 text-sm text-gray-600">
            We created your account for{' '}
            <span className="font-medium text-gray-900">
              {successState.email}
            </span>
            . Please verify your email before signing in.
          </p>

          {notice && (
            <div className="mb-4 rounded bg-green-50 p-3 text-sm text-green-700">
              {notice}
            </div>
          )}

          {error && (
            <div
              className="mb-4 rounded bg-red-50 p-3 text-sm text-red-600"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={isResending}
              className="w-full rounded bg-blue-600 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isResending
                ? 'Sending verification link...'
                : 'Resend verification email'}
            </button>

            {successState.verificationUrl && (
              <a
                href={successState.verificationUrl}
                className="block w-full rounded border border-gray-300 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Open verification link
              </a>
            )}
          </div>

          <p className="mt-4 text-center text-sm text-gray-600">
            Already verified?{' '}
            <Link
              to="/login"
              className="text-blue-600 hover:text-blue-500"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h2 className="mb-6 text-2xl font-bold text-gray-900">
          Create Account
        </h2>

        {error && (
          <div
            className="mb-4 rounded bg-red-50 p-3 text-sm text-red-600"
            role="alert"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="register-name"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Name
            </label>
            <input
              type="text"
              id="register-name"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              autoComplete="name"
              className="w-full rounded border p-2 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="register-email"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              type="email"
              id="register-email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              autoComplete="email"
              className="w-full rounded border p-2 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="register-password"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <input
              type="password"
              id="register-password"
              name="password"
              required
              minLength={8}
              value={formData.password}
              onChange={handleChange}
              autoComplete="new-password"
              className="w-full rounded border p-2 focus:border-blue-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-gray-500">
              Use at least 8 characters with letters and numbers.
            </p>
          </div>

          <div>
            <label
              htmlFor="register-confirm-password"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Confirm Password
            </label>
            <input
              type="password"
              id="register-confirm-password"
              name="confirmPassword"
              required
              minLength={8}
              value={formData.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
              className="w-full rounded border p-2 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
            <p
              className={
                passwordChecks.minLength
                  ? 'text-green-600'
                  : 'text-gray-600'
              }
            >
              At least 8 characters
            </p>
            <p
              className={
                passwordChecks.hasLetter
                  ? 'text-green-600'
                  : 'text-gray-600'
              }
            >
              Contains letters
            </p>
            <p
              className={
                passwordChecks.hasNumber
                  ? 'text-green-600'
                  : 'text-gray-600'
              }
            >
              Contains numbers
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-600 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>

          <button
            type="button"
            onClick={registerWithGoogle}
            disabled={loading}
            className="w-full rounded border border-gray-300 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Continue with Google
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-blue-600 hover:text-blue-500"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
};

function getGoogleOAuthErrorMessage(errorCode: string) {
  switch (errorCode) {
    case 'google_oauth_not_configured':
      return 'Google sign-up is not configured yet.';
    case 'google_oauth_cancelled':
      return 'Google sign-up was cancelled before completion.';
    case 'google_email_not_verified':
      return 'Your Google account email must be verified before signing up.';
    case 'google_account_link_conflict':
      return 'This email is already linked to a different Google account.';
    default:
      return 'We could not complete Google sign-up. Please try again.';
  }
}
