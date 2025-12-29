import { useState } from 'react';
import { UserPlusIcon } from '@heroicons/react/24/outline';
import { UserList } from '@/features/company/components/UserList';
import { InviteUserModal } from '@/features/company/components/InviteUserModal';
import { useCompany } from '@/contexts/CompanyContext';
import { NoCompanySelected } from '@/components/ui';

export default function TeamManagement() {
  const { currentCompany } = useCompany();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Define a reload key or mechanism? UserList handles data fetching.
  // Passing a key to UserList to force reload when invite succeeds?
  const [refreshKey, setRefreshKey] = useState(0);

  const handleInviteSuccess = () => {
    setRefreshKey((prev) => prev + 1);
  };

  if (!currentCompany) {
    return <NoCompanySelected message="Please select a company to manage team." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Team Management
          </h1>
          <p className="text-gray-500">
            Manage members and roles for {currentCompany.name}
          </p>
        </div>
        <button
          onClick={() => setIsInviteModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <UserPlusIcon className="w-5 h-5" />
          Invite User
        </button>
      </div>

      <UserList key={refreshKey} />

      <InviteUserModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onSuccess={handleInviteSuccess}
      />
    </div>
  );
}
