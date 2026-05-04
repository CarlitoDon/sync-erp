import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { trpc } from '@/lib/trpc';

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
          }
        >
          {message}
        </div>

        <div className="mt-5 space-y-3">
          {status === 'error' && (
            <Link
              to="/register"
              className="block w-full rounded bg-blue-600 py-2 text-center text-white hover:bg-blue-700"
            >
              Back to registration
            </Link>
          )}

          {status !== 'verifying' && (
            <Link
              to="/login"
              className="block w-full rounded border border-gray-300 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Go to sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
