import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../../contexts/CompanyContext';
import { useAuth } from '../../../contexts/AuthContext';
import {
  createCompany,
  joinCompany,
} from '../services/companyService';
import type { Company } from '@sync-erp/shared';
import { AxiosError } from 'axios';

export function CompanySelectionPage() {
  const navigate = useNavigate();
  const { logout } = useAuth(); // Allow logout if stuck
  const {
    companies,
    setCurrentCompany,
    refreshCompanies,
    isLoading,
  } = useCompany();
  // State for switching views: 'list' | 'create' | 'join'
  const [view, setView] = useState<'list' | 'create' | 'join'>(
    'list'
  );

  // Form states and loading
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const handleSelectCompany = (company: Company) => {
    setCurrentCompany(company);
    navigate('/'); // Redirect to dashboard
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const newCompany = await createCompany({
        name: newCompanyName,
      });
      await refreshCompanies(); // Reload list
      setCurrentCompany(newCompany); // Auto-select? Or go to list? User story says "Onboard". Let's auto-select.
      navigate('/');
    } catch (err) {
      setError(
        (err as AxiosError<{ error: { message: string } }>)?.response
          ?.data?.error?.message || 'Failed to create company'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const joinedCompany = await joinCompany({ inviteCode });
      await refreshCompanies(); // Reload list
      setCurrentCompany(joinedCompany); // Auto-select
      navigate('/');
    } catch (err) {
      setError(
        (err as AxiosError<{ error: { message: string } }>)?.response
          ?.data?.error?.message || 'Failed to join company'
      );
    } finally {
      setIsSubmitting(false);
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading companies...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Select a Company
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          You need to select a company context to proceed.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div
              className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded relative"
              role="alert"
            >
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {/* List View */}
          {view === 'list' && (
            <div className="space-y-4">
              {companies.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  <p>You are not a member of any company yet.</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {companies.map((company) => (
                    <li
                      key={company.id}
                      className="py-4 flex justify-between items-center group cursor-pointer hover:bg-gray-50 p-2 rounded"
                      onClick={() => handleSelectCompany(company)}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {company.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          Created:{' '}
                          {new Date(
                            company.createdAt
                          ).toLocaleDateString()}
                        </p>
                      </div>
                      <button className="ml-4 bg-white border border-gray-300 rounded-md shadow-sm px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        Select
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-6 flex flex-col gap-3">
                <button
                  onClick={() => setView('create')}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Create New Company
                </button>
                <button
                  onClick={() => setView('join')}
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Join Existing Company
                </button>
              </div>
            </div>
          )}

          {/* Create View */}
          {view === 'create' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Create Company
              </h3>
              <form
                onSubmit={handleCreateCompany}
                className="space-y-4"
              >
                <div>
                  <label
                    htmlFor="companyName"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Company Name
                  </label>
                  <input
                    type="text"
                    id="companyName"
                    required
                    value={newCompanyName}
                    onChange={(e) =>
                      setNewCompanyName(e.target.value)
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="My Great Company"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={resetForms}
                    disabled={isSubmitting}
                    className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Join View */}
          {view === 'join' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Join Company
              </h3>
              <form
                onSubmit={handleJoinCompany}
                className="space-y-4"
              >
                <div>
                  <label
                    htmlFor="inviteCode"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Invite Code
                  </label>
                  <input
                    type="text"
                    id="inviteCode"
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Enter code"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={resetForms}
                    disabled={isSubmitting}
                    className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Joining...' : 'Join'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="mt-6 border-t pt-4">
            <button
              onClick={handleLogout}
              className="w-full flex justify-center py-2 px-4 text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
