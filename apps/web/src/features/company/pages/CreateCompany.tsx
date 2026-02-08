import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { PageContainer } from '@/components/layout/PageLayout';
import { Input } from '@/components/ui';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/Card';

export default function CreateCompany() {
  const navigate = useNavigate();
  const { setCurrentCompany } = useCompany();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = trpc.company.create.useMutation({
    onSuccess: (company) => {
      setCurrentCompany(company);
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
    <PageContainer>
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Create Company</CardTitle>
            <CardDescription>
              Set up a new company in Sync ERP
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                label="Company Name"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter company name"
                disabled={createMutation.isPending}
                error={error || undefined}
              />

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
                  className="flex-1 px-4 py-3 bg-linear-to-r from-primary-500 to-primary-600 text-white rounded-lg font-medium hover:from-primary-600 hover:to-primary-700 transition-all disabled:opacity-50"
                  // disabled:opacity-50 was already there
                >
                  {createMutation.isPending
                    ? 'Creating...'
                    : 'Create Company'}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
