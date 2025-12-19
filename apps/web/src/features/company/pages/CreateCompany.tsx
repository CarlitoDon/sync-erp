import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';

export default function CreateCompany() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { setCurrentCompany } = useCompany();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = trpc.company.create.useMutation({
    onSuccess: (company) => {
      utils.company.list.invalidate();
      setCurrentCompany(company);
      localStorage.setItem('currentCompanyId', company.id);
      navigate('/');
    },
    onError: (err) => {
      setError(
        err.message || 'Failed to create company. Please try again.'
      );
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name || name.length < 2) {
      setError('Company name must be at least 2 characters');
      return;
    }

    createMutation.mutate({ name });
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Create Company
        </h1>
        <p className="text-gray-500 mb-6">
          Set up a new company in Sync ERP
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Company Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter company name"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              disabled={createMutation.isPending}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="flex space-x-4">
            <button
              type="button"
              onClick={() => navigate('/companies')}
              className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              disabled={createMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg font-medium hover:from-primary-600 hover:to-primary-700 transition-all disabled:opacity-50"
            >
              {createMutation.isPending
                ? 'Creating...'
                : 'Create Company'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
