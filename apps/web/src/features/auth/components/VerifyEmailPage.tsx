import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
<<<<<<< HEAD
import { BrandMark } from '@/components/brand/BrandMark';
=======
>>>>>>> origin/dev

export const VerifyEmailPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const attemptedRef = useRef(false);
  const [status, setStatus] = useState<
    'verifying' | 'success' | 'error'
  >(token ? 'verifying' : 'error');
  const [message, setMessage] = useState(
    token
      ? 'Verifying your email...'
      : 'Verification link is missing or invalid.'
  );

  const verifyEmailMutation = trpc.auth.verifyEmail.useMutation();

  useEffect(() => {
    if (!token || attemptedRef.current) {
      return;
    }

    attemptedRef.current = true;

    verifyEmailMutation
      .mutateAsync({ token })
      .then(() => {
        setStatus('success');
        setMessage(
          'Your email has been verified. Redirecting you to company setup...'
        );
        window.setTimeout(() => {
          navigate('/select-company', { replace: true });
        }, 1200);
      })
      .catch((error: Error) => {
        setStatus('error');
        setMessage(error.message);
      });
  }, [navigate, token, verifyEmailMutation]);

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
              Email Verification
            </h2>
          </div>
        </div>
        <div
          className={
            status === 'success'
              ? 'rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700'
              : status === 'error'
                ? 'rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700'
                : 'rounded-md border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-800'
=======
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h2 className="mb-3 text-2xl font-bold text-gray-900">
          Email Verification
        </h2>
        <div
          className={
            status === 'success'
              ? 'rounded bg-green-50 p-4 text-sm text-green-700'
              : status === 'error'
                ? 'rounded bg-red-50 p-4 text-sm text-red-600'
                : 'rounded bg-blue-50 p-4 text-sm text-blue-700'
>>>>>>> origin/dev
          }
        >
          {message}
        </div>

        <div className="mt-5 space-y-3">
          {status === 'error' && (
            <Link
              to="/register"
<<<<<<< HEAD
              className="block w-full rounded-md bg-slate-950 py-2 text-center text-white shadow-sm hover:bg-slate-800"
=======
              className="block w-full rounded bg-blue-600 py-2 text-center text-white hover:bg-blue-700"
>>>>>>> origin/dev
            >
              Back to registration
            </Link>
          )}

          {status !== 'verifying' && (
            <Link
              to="/login"
<<<<<<< HEAD
              className="block w-full rounded-md border border-slate-300 bg-white py-2 text-center text-sm font-medium text-slate-700 shadow-sm hover:border-slate-400 hover:bg-slate-50"
=======
              className="block w-full rounded border border-gray-300 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
>>>>>>> origin/dev
            >
              Go to sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
