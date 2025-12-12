import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { useCompany } from '../../../contexts/CompanyContext';
import { apiAction } from '../../../utils/apiAction';
import { userService } from '../services/userService';
import { AssignRoleSchema } from '@sync-erp/shared';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';

const AssignUserFormSchema = AssignRoleSchema.pick({ roleId: true });

interface AssignCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  userId: string;
  userName: string;
}

export function AssignCompanyModal({
  isOpen,
  onClose,
  onSuccess,
  userId,
  userName,
}: AssignCompanyModalProps) {
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>(
    []
  );

  useEffect(() => {
    // Fetch roles - Mock for now or implement roleService?
    // For MVP, hardcode roles or fetch if endpoint exists.
    // Assuming generic roles for now.
    setRoles([
      { id: 'admin-uuid', name: 'Admin' }, // Replace with actual Role fetching
      { id: 'member-uuid', name: 'Member' },
      { id: 'viewer-uuid', name: 'Viewer' },
    ]);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<{ roleId: string }>({
    resolver: zodResolver(AssignUserFormSchema),
  });

  const onSubmit = async (data: { roleId: string }) => {
    if (!currentCompany) return;
    setLoading(true);
    await apiAction(
      () =>
        userService.assign(currentCompany.id, {
          userId,
          roleId: data.roleId,
        }),
      {
        onSuccess: () => {
          onSuccess?.();
          onClose();
          reset();
        },
        successMessage: 'Role assigned successfully!',
        onError: () => setLoading(false),
      }
    );
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Role to {userName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="roleId" className="text-right">
                Role
              </Label>
              <div className="col-span-3">
                <select
                  id="roleId"
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  {...register('roleId')}
                >
                  <option value="">Select a role...</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
                {errors.roleId && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.roleId.message}
                  </p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Assigning...' : 'Assign Role'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
