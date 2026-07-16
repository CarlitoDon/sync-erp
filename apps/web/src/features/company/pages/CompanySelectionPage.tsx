import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';
import type { Company } from '@/types/api';
import { Card, CardContent } from '@/components/ui/Card';
import { getPostCompanyRedirect } from '@/features/billing/planIntent';
import { BrandMark } from '@/components/brand/BrandMark';
import { Button, Input } from '@/components/ui';

export function CompanySelectionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { logout } = useAuth(); // Allow logout if stuck
  const {
    companies,
    setCurrentCompany,
    refreshCompanies,
    isLoading,
  } = useCompany();
  // State for switching views: 'list' | 'create' | 'join'
  // eslint-disable-next-line @sync-erp/no-hardcoded-enum
  const [view, setView] = useState<'list' | 'create' | 'join'>(
    'list'
  );

  // tRPC Mutations
  const createMutation = trpc.company.create.useMutation();
  const joinMutation = trpc.company.join.useMutation();

  // Form states
  const [error, setError] = useState<string | null>(null);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => {
    const codeFromUrl = searchParams.get('inviteCode')?.trim();
    if (!codeFromUrl) return;

    setInviteCode(codeFromUrl);
    setView('join');
  }, [searchParams]);

  const isSubmitting =
    createMutation.isPending || joinMutation.isPending;

  const handleSelectCompany = (company: Company) => {
    setCurrentCompany(company);
    navigate(getPostCompanyRedirect()); // Redirect to dashboard or pending plan checkout
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const newCompany = await createMutation.mutateAsync({
        name: newCompanyName,
      });
      await refreshCompanies(); // Reload list
      setCurrentCompany(newCompany); // Auto-select
      navigate(getPostCompanyRedirect());
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to create company';
      setError(message);
    }
  };

  const handleJoinCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const joinedCompany = await joinMutation.mutateAsync({
        inviteCode,
      });
      await refreshCompanies(); // Reload list
      setCurrentCompany(joinedCompany); // Auto-select
      navigate('/dashboard');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to join company';
      setError(message);
    }
  };

  const resetForms = () => {
    setView('list');
    setError(null);
    setNewCompanyName('');
    setInviteCode('');
  };

  if (isLoading) {
    return (
      <div className="auth-grid-background flex min-h-screen items-center justify-center">
        <div className="text-slate-500">Loading companies...</div>
      </div>
    );
  }

  return (
    <div className="auth-grid-background flex min-h-screen flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto flex justify-center">
          <BrandMark />
        </div>
        <h2 className="mt-5 text-center text-3xl font-bold text-slate-950">
          Select a Company
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          You need to select a company context to proceed.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <CardContent className="py-8 px-4 sm:px-10">
            {error && (
              <div
                className="relative mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700"
                role="alert"
              >
                <span className="block sm:inline">{error}</span>
              </div>
            )}

            {/* List View */}
            {view === 'list' && (
              <div className="space-y-4">
                {companies.length === 0 ? (
                  <div className="py-4 text-center text-slate-500">
                    <p>You are not a member of any company yet.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-200">
                    {companies.map((company) => (
                      <li
                        key={company.id}
                        className="group flex cursor-pointer items-center justify-between rounded-md p-2 py-4 hover:bg-slate-50"
                        onClick={() => handleSelectCompany(company)}
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-950">
                            {company.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            Created:{' '}
                            {new Date(
                              company.createdAt
                            ).toLocaleDateString()}
                          </p>
                        </div>
                        <button className="ml-4 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2">
                          Select
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-6 flex flex-col gap-3">
                  <Button
                    onClick={() => setView('create')}
                    className="w-full"
                  >
                    Create New Company
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setView('join')}
                    className="w-full"
                  >
                    Join Existing Company
                  </Button>
                </div>
              </div>
            )}

            {/* Create View */}
            {view === 'create' && (
              <div>
                <h3 className="mb-4 text-lg font-semibold text-slate-950">
                  Create Company
                </h3>
                <form
                  onSubmit={handleCreateCompany}
                  className="space-y-4"
                >
                  <Input
                    label="Company Name"
                    type="text"
                    id="companyName"
                    required
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="My Great Company"
                  />
                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetForms}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      isLoading={isSubmitting}
                      loadingText="Creating..."
                    >
                      Create
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* Join View */}
            {view === 'join' && (
              <div>
                <h3 className="mb-4 text-lg font-semibold text-slate-950">
                  Join Company
                </h3>
                <form
                  onSubmit={handleJoinCompany}
                  className="space-y-4"
                >
                  <Input
                    label="Invite Code"
                    type="text"
                    id="inviteCode"
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="Enter code"
                  />
                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetForms}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      isLoading={isSubmitting}
                      loadingText="Joining..."
                    >
                      Join
                    </Button>
                  </div>
                </form>
              </div>
            )}

            <div className="mt-6 border-t border-slate-200 pt-4">
              <button
                onClick={handleLogout}
                className="flex w-full justify-center px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                Log out
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
