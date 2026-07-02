import React from 'react';
import { Sentry } from '@/lib/sentry';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

function ErrorFallback({ resetError }: { resetError: () => void }) {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
          Sync ERP
        </p>
        <h1 className="mt-3 text-2xl font-semibold">
          Terjadi kendala saat memuat halaman
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Data Anda tetap aman. Coba muat ulang halaman, atau hubungi admin jika masalah berulang.
        </p>
        <button
          type="button"
          onClick={resetError}
          className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Coba lagi
        </button>
      </div>
    </main>
  );
}

export function AppErrorBoundary({ children }: AppErrorBoundaryProps) {
  return (
    <Sentry.ErrorBoundary fallback={({ resetError }) => <ErrorFallback resetError={resetError} />}>
      {children}
    </Sentry.ErrorBoundary>
  );
}
