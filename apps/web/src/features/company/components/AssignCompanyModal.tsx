import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { useCompany } from '@/contexts/CompanyContext';
import { apiAction } from '@/utils/apiAction';
import { userService } from '@/features/company/services/userService';
import { AssignRoleSchema } from '@sync-erp/shared';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/Select';

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
    handleSubmit,
    control,
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
        userService.assign({
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
                <Controller
                  name="roleId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onChange={field.onChange}
                      options={roles.map((r) => ({
                        value: r.id,
                        label: r.name,
                      }))}
                      placeholder="Select a role..."
                    />
                  )}
                />
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
