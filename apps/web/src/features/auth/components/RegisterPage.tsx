import { useEffect, useMemo, useState } from 'react';
import {
  useNavigate,
  Link,
  useSearchParams,
} from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { RegisterInput } from '@/types/api';
import { setBillingPlanIntent } from '@/features/billing/planIntent';
import {
  DEFAULT_BILLING_PLAN_KEY,
  getBillingPlan,
  isBillingPlanKey,
} from '@sync-erp/shared';
import { BrandMark } from '@/components/brand/BrandMark';
import { Button, Input } from '@/components/ui';

interface RegisterFormState extends RegisterInput {
  confirmPassword: string;
}

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
<<<<<<< HEAD
  const selectedPlan = useMemo(() => {
    const rawPlan = searchParams.get('plan');
    const planKey = isBillingPlanKey(rawPlan)
      ? rawPlan
      : DEFAULT_BILLING_PLAN_KEY;

    return getBillingPlan(planKey);
  }, [searchParams]);
=======
>>>>>>> origin/dev

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
<<<<<<< HEAD
      setBillingPlanIntent(selectedPlan.key);
=======
>>>>>>> origin/dev
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

<<<<<<< HEAD
  const handleGoogleRegister = () => {
    setBillingPlanIntent(selectedPlan.key);
    registerWithGoogle();
  };

=======
>>>>>>> origin/dev
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
<<<<<<< HEAD
      <div className="auth-grid-background flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-xl shadow-slate-300/40">
          <div className="mb-6 flex items-center gap-3">
            <BrandMark />
            <div>
              <p className="text-sm font-medium text-slate-500">
                Sync ERP
              </p>
              <h2 className="text-2xl font-bold text-slate-950">
                Verify Your Email
              </h2>
            </div>
          </div>
          <p className="mb-4 text-sm leading-6 text-slate-600">
            We created your account for{' '}
            <span className="font-medium text-slate-950">
=======
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
          <h2 className="mb-3 text-2xl font-bold text-gray-900">
            Verify Your Email
          </h2>
          <p className="mb-4 text-sm text-gray-600">
            We created your account for{' '}
            <span className="font-medium text-gray-900">
>>>>>>> origin/dev
              {successState.email}
            </span>
            . Please verify your email before signing in.
          </p>

          {notice && (
<<<<<<< HEAD
            <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
=======
            <div className="mb-4 rounded bg-green-50 p-3 text-sm text-green-700">
>>>>>>> origin/dev
              {notice}
            </div>
          )}

          {error && (
            <div
<<<<<<< HEAD
              className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
=======
              className="mb-4 rounded bg-red-50 p-3 text-sm text-red-600"
>>>>>>> origin/dev
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="space-y-3">
<<<<<<< HEAD
            <Button
              type="button"
              onClick={handleResendVerification}
              isLoading={isResending}
              loadingText="Sending verification link..."
              className="w-full"
            >
              Resend verification email
            </Button>
=======
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
>>>>>>> origin/dev

            {successState.verificationUrl && (
              <a
                href={successState.verificationUrl}
<<<<<<< HEAD
                className="block w-full rounded-md border border-slate-300 bg-white py-2 text-center text-sm font-medium text-slate-700 shadow-sm hover:border-slate-400 hover:bg-slate-50"
=======
                className="block w-full rounded border border-gray-300 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
>>>>>>> origin/dev
              >
                Open verification link
              </a>
            )}
          </div>

<<<<<<< HEAD
          <p className="mt-4 text-center text-sm text-slate-600">
            Already verified?{' '}
            <Link
              to="/login"
              className="font-medium text-cyan-700 hover:text-cyan-900"
=======
          <p className="mt-4 text-center text-sm text-gray-600">
            Already verified?{' '}
            <Link
              to="/login"
              className="text-blue-600 hover:text-blue-500"
>>>>>>> origin/dev
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

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
              Create Account
            </h2>
          </div>
        </div>

        <div className="mb-5 rounded-lg border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900">
          <p className="font-semibold">
            Starting with {selectedPlan.name}
          </p>
          <p className="mt-1 leading-6">
            {selectedPlan.key === DEFAULT_BILLING_PLAN_KEY
              ? 'Free plan is active by default for one company. You can upgrade any time from Billing.'
              : 'We will keep this plan intent after registration, then send you to Billing after company onboarding.'}
          </p>
        </div>

        {error && (
          <div
<<<<<<< HEAD
            className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
=======
            className="mb-4 rounded bg-red-50 p-3 text-sm text-red-600"
>>>>>>> origin/dev
            role="alert"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
<<<<<<< HEAD
          <Input
            label="Name"
            type="text"
            id="register-name"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            autoComplete="name"
          />

          <Input
            label="Email"
            type="email"
            id="register-email"
            name="email"
            required
            value={formData.email}
            onChange={handleChange}
            autoComplete="email"
          />

          <Input
            label="Password"
            type="password"
            id="register-password"
            name="password"
            required
            minLength={8}
            value={formData.password}
            onChange={handleChange}
            autoComplete="new-password"
            helperText="Use at least 8 characters with letters and numbers."
          />

          <Input
            label="Confirm Password"
            type="password"
            id="register-confirm-password"
            name="confirmPassword"
            required
            minLength={8}
            value={formData.confirmPassword}
            onChange={handleChange}
            autoComplete="new-password"
          />

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <p
              className={
                passwordChecks.minLength
                  ? 'text-emerald-700'
                  : 'text-slate-600'
              }
            >
              At least 8 characters
            </p>
            <p
              className={
                passwordChecks.hasLetter
                  ? 'text-emerald-700'
                  : 'text-slate-600'
              }
            >
              Contains letters
            </p>
            <p
              className={
                passwordChecks.hasNumber
                  ? 'text-emerald-700'
                  : 'text-slate-600'
              }
            >
              Contains numbers
            </p>
          </div>

          <Button
=======
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
>>>>>>> origin/dev
            type="submit"
            className="w-full"
            isLoading={loading}
            loadingText="Creating account..."
          >
<<<<<<< HEAD
            Sign Up
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleRegister}
            disabled={loading}
            className="w-full"
          >
            Continue with Google
          </Button>
=======
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
>>>>>>> origin/dev
        </form>

        <p className="mt-4 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-cyan-700 hover:text-cyan-900"
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
