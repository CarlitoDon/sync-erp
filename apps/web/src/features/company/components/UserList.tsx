import { useState } from 'react';
import { userService } from '../services/userService';
import { useCompany } from '../../../contexts/CompanyContext';
import { useCompanyData } from '../../../hooks/useCompanyData';
import { User, CompanyMember } from '@sync-erp/shared';
import ActionButton from '../../../components/ui/ActionButton';
import { AssignCompanyModal } from './AssignCompanyModal';

export function UserList() {
  const { currentCompany } = useCompany();
  const {
    data: users,
    loading,
    refresh: loadUsers,
  } = useCompanyData<(User & { roles: CompanyMember[] })[]>(
    userService.listByCompany,
    []
  );

  const [assigningUser, setAssigningUser] = useState<User | null>(
    null
  );

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">
        Loading team members...
      </div>
    );
  }

  if (!currentCompany) {
    return (
      <div className="p-8 text-center text-gray-500">
        Please select a company.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Role
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  No team members found. Invite someone!
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {user.name}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {/* Find role for current company */}
                    {(user.roles &&
                      user.roles.find(
                        (r) => r.companyId === currentCompany.id
                      )?.roleId) ||
                      '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ActionButton
                      variant="primary"
                      onClick={() => setAssigningUser(user)}
                    >
                      Assign Role
                    </ActionButton>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {assigningUser && (
        <AssignCompanyModal
          isOpen={!!assigningUser}
          onClose={() => setAssigningUser(null)}
          onSuccess={loadUsers}
          userId={assigningUser.id}
          userName={assigningUser.name}
        />
      )}
    </div>
  );
}
