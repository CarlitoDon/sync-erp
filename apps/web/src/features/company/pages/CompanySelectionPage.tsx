import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';
import type { Company } from '@/types/api';
import { getPostCompanyRedirect } from '@/features/billing/planIntent';
import { BrandMark } from '@/components/brand/BrandMark';
import { Button } from '@/components/ui';
import {
  BuildingOffice2Icon,
  PlusIcon,
  UserGroupIcon,
  ArrowRightIcon,
  ArrowRightOnRectangleIcon,
  SparklesIcon,
  KeyIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

export function CompanySelectionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, logout } = useAuth();
  const {
    companies,
    setCurrentCompany,
    refreshCompanies,
    isLoading,
  } = useCompany();

  // State for switching views: 'list' | 'create' | 'join'
  // eslint-disable-next-line @sync-erp/no-hardcoded-enum
  const [view, setView] = useState<'list' | 'create' | 'join'>('list');

  // tRPC Mutations
  const createMutation = trpc.company.create.useMutation();
  const joinMutation = trpc.company.join.useMutation();

  // Form states
  const [error, setError] = useState<string | null>(null);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => {
    const codeFromUrl = searchParams.get('inviteCode')?.trim();
    if (codeFromUrl) {
      setInviteCode(codeFromUrl);
      setView('join');
      return;
    }

    // If loaded and user has no companies, automatically focus on creating one
    if (!isLoading && companies.length === 0) {
      setView('create');
    }
  }, [searchParams, isLoading, companies.length]);

  const isSubmitting =
    createMutation.isPending || joinMutation.isPending;

  const handleSelectCompany = (company: Company) => {
    setCurrentCompany(company);
    navigate(getPostCompanyRedirect());
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    setError(null);
    try {
      const newCompany = await createMutation.mutateAsync({
        name: newCompanyName.trim(),
      });
      await refreshCompanies();
      setCurrentCompany(newCompany);
      navigate(getPostCompanyRedirect());
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Gagal membuat perusahaan. Silakan coba lagi.';
      setError(message);
    }
  };

  const handleJoinCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setError(null);
    try {
      const joinedCompany = await joinMutation.mutateAsync({
        inviteCode: inviteCode.trim(),
      });
      await refreshCompanies();
      setCurrentCompany(joinedCompany);
      navigate('/dashboard');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Kode undangan tidak valid atau kedaluwarsa.';
      setError(message);
    }
  };

  const resetForms = () => {
    setView(companies.length === 0 ? 'create' : 'list');
    setError(null);
    setNewCompanyName('');
    setInviteCode('');
  };

  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  if (isLoading) {
    return (
      <div className="auth-grid-background flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <BrandMark size="lg" />
          <p className="text-sm font-medium text-slate-500 animate-pulse">
            Memuat data workspace...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-grid-background flex min-h-screen flex-col justify-between px-4 py-8 sm:px-6 lg:px-8">
      {/* Background Ambient Glow */}
      <div className="ambient-glow" />

      {/* Top Bar Header */}
      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between">
        <div className="flex items-center gap-3">
          <BrandMark size="md" />
          <div>
            <span className="text-base font-bold tracking-tight text-slate-900">
              Sync ERP
            </span>
            <span className="ml-2 hidden rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-200/60 sm:inline">
              Workspace Platform
            </span>
          </div>
        </div>

        {/* User profile & Logout pill */}
        {user && (
          <div className="flex items-center gap-3 rounded-full border border-slate-200/80 bg-white/80 py-1.5 pl-2 pr-3 shadow-xs backdrop-blur-md">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-sky-500 text-xs font-bold text-white shadow-xs">
              {userInitials}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-xs font-semibold text-slate-900 leading-none">
                {user.name}
              </p>
              <p className="text-[11px] text-slate-500 leading-none mt-0.5">
                {user.email}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="ml-1 inline-flex items-center gap-1 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600"
              title="Keluar"
              aria-label="Keluar dari akun"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 my-auto mx-auto w-full max-w-xl py-8">
        <div className="glass-panel overflow-hidden rounded-3xl p-6 sm:p-10 transition-all duration-300">
          {/* Error Message */}
          {error && (
            <div
              className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/90 p-4 text-sm text-red-800 backdrop-blur-xs"
              role="alert"
            >
              <div className="shrink-0 text-red-600">⚠️</div>
              <div className="flex-1 font-medium">{error}</div>
              <button
                onClick={() => setError(null)}
                className="text-red-500 hover:text-red-700 text-xs"
              >
                ✕
              </button>
            </div>
          )}

          {/* VIEW: CREATE COMPANY (First time or New) */}
          {view === 'create' && (
            <div>
              <div className="mb-8 text-center sm:text-left">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200/60 mb-3">
                  <SparklesIcon className="h-3.5 w-3.5 text-blue-600" />
                  <span>
                    {companies.length === 0
                      ? 'Langkah Pertama • Workspace Baru'
                      : 'Tambah Workspace Baru'}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                  {companies.length === 0
                    ? 'Siapkan Workspace Bisnis Anda'
                    : 'Buat Perusahaan Baru'}
                </h1>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Satu workspace terintegrasi untuk mengelola rental, pesanan,
                  inventaris barang, dan pembukuan keuangan real-time.
                </p>
              </div>

              <form onSubmit={handleCreateCompany} className="space-y-6">
                <div>
                  <label
                    htmlFor="companyName"
                    className="block text-sm font-semibold text-slate-800 mb-2"
                  >
                    Nama Perusahaan / Usaha <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <BuildingOffice2Icon className="h-5 w-5" />
                    </div>
                    <input
                      id="companyName"
                      type="text"
                      required
                      autoFocus
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      placeholder="Contoh: PT Maju Gemilang…"
                      className="block w-full rounded-xl border border-slate-300 bg-white/95 py-3 pl-11 pr-4 text-base text-slate-900 placeholder:text-slate-400 shadow-xs transition-colors focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/15"
                    />
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                  {companies.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetForms}
                      disabled={isSubmitting}
                      className="w-full sm:w-auto"
                    >
                      <ArrowLeftIcon className="h-4 w-4 mr-1" />
                      Batal
                    </Button>
                  )}
                  <button
                    type="submit"
                    disabled={isSubmitting || !newCompanyName.trim()}
                    className="inline-flex w-full flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 hover:from-blue-500 hover:to-blue-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      'Membuat Workspace...'
                    ) : (
                      <>
                        <span>Lanjutkan ke Onboarding</span>
                        <ArrowRightIcon className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Toggle to Join */}
              <div className="mt-8 border-t border-slate-200/80 pt-5 text-center">
                <p className="text-sm text-slate-500">
                  Sudah punya tim yang menggunakan Sync ERP?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setView('join');
                    }}
                    className="font-semibold text-blue-600 transition-colors hover:text-blue-800 underline underline-offset-2"
                  >
                    Gabung dengan kode undangan
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* VIEW: JOIN COMPANY VIA CODE */}
          {view === 'join' && (
            <div>
              <div className="mb-8 text-center sm:text-left">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/60 mb-3">
                  <KeyIcon className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Undangan Kolaborasi Tim</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                  Gabung ke Perusahaan yang Ada
                </h1>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Masukkan kode undangan yang diberikan oleh pemilik atau admin
                  workspace untuk langsung bergabung ke sistem tim Anda.
                </p>
              </div>

              <form onSubmit={handleJoinCompany} className="space-y-6">
                <div>
                  <label
                    htmlFor="inviteCode"
                    className="block text-sm font-semibold text-slate-800 mb-2"
                  >
                    Kode Undangan (Invite Code) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <KeyIcon className="h-5 w-5" />
                    </div>
                    <input
                      id="inviteCode"
                      type="text"
                      required
                      autoFocus
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      placeholder="CONTOH: INV-98271"
                      className="block w-full rounded-xl border border-slate-300 bg-white/95 py-3 pl-11 pr-4 font-mono text-base font-semibold tracking-wider text-slate-900 placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400 shadow-xs transition-colors focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/15"
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Hubungi admin workspace Anda jika belum memiliki kode ini.
                  </p>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetForms}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto"
                  >
                    <ArrowLeftIcon className="h-4 w-4 mr-1" />
                    Kembali
                  </Button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !inviteCode.trim()}
                    className="inline-flex w-full flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all duration-200 hover:from-emerald-500 hover:to-emerald-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      'Memproses Undangan...'
                    ) : (
                      <>
                        <span>Gabung ke Workspace</span>
                        <ArrowRightIcon className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-8 border-t border-slate-200/80 pt-5 text-center">
                <p className="text-sm text-slate-500">
                  Ingin mendaftarkan usaha Anda sendiri?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setView('create');
                    }}
                    className="font-semibold text-blue-600 transition-colors hover:text-blue-800 underline underline-offset-2"
                  >
                    Buat workspace baru
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* VIEW: LIST COMPANIES (When companies exist) */}
          {view === 'list' && (
            <div>
              <div className="mb-6 text-center sm:text-left">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200/60 mb-3">
                  <UserGroupIcon className="h-3.5 w-3.5 text-blue-600" />
                  <span>Workspace Terdaftar ({companies.length})</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                  Pilih Workspace Anda
                </h1>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Pilih entitas bisnis yang ingin Anda kelola atau buat workspace
                  baru.
                </p>
              </div>

              <div className="space-y-3">
                {companies.map((company) => {
                  const companyInitials = company.name
                    .split(' ')
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <div
                      key={company.id}
                      onClick={() => handleSelectCompany(company)}
                      className="group flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-white/90 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md hover:shadow-blue-500/5 active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-sky-500 text-sm font-bold text-white shadow-xs">
                          {companyInitials}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                              {company.name}
                            </h3>
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200/60">
                              Aktif
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Dibuat:{' '}
                            {new Date(company.createdAt).toLocaleDateString(
                              'id-ID',
                              {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              }
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                        <span>Buka</span>
                        <ArrowRightIcon className="h-4 w-4" />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-200/80">
                <Button
                  onClick={() => setView('create')}
                  className="flex-1"
                >
                  <PlusIcon className="h-4 w-4 mr-1.5" />
                  Buat Perusahaan Baru
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setView('join')}
                  className="w-full sm:w-auto"
                >
                  <KeyIcon className="h-4 w-4 mr-1.5" />
                  Gabung via Kode
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer info */}
      <footer className="relative z-10 mx-auto w-full max-w-5xl text-center text-xs text-slate-400">
        <p>© 2026 Sync ERP. Seluruh hak cipta dilindungi.</p>
      </footer>
    </div>
  );
}

