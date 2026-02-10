import { useState } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
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
import { toast } from 'react-hot-toast';
import { trpc } from '@/lib/trpc';

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
  const trpcUtils = trpc.useUtils();
  const updateRoleMutation =
    trpc.company.updateMemberRole.useMutation({
      onSuccess: () => {
        trpcUtils.user.listByCompany.invalidate();
      },
    });
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');

  // Hardcoded roles for MVP - this feature needs backend support
  const roles = [
    { id: 'admin', name: 'Admin' },
    { id: 'member', name: 'Member' },
    { id: 'viewer', name: 'Viewer' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany || !selectedRole) return;

    setLoading(true);
    try {
      await updateRoleMutation.mutateAsync({
        companyId: currentCompany.id,
        userId,
        roleId: selectedRole,
      });
      toast.success('Role assigned successfully!');
      onSuccess?.();
      onClose();
    } catch {
      toast.error('Failed to assign role');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Role to {userName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="roleId" className="text-right">
                Role
              </Label>
              <div className="col-span-3">
                <Select
                  value={selectedRole}
                  onChange={setSelectedRole}
                  options={roles.map((r) => ({
                    value: r.id,
                    label: r.name,
                  }))}
                  placeholder="Select a role..."
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 col-span-4">
              Note: User ID: {userId}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !selectedRole}>
              {loading ? 'Assigning...' : 'Assign Role'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
