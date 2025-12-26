import { trpc } from '@/lib/trpc';
import { apiAction } from '@/hooks/useApiAction';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { PartnerTypeSchema } from '@sync-erp/shared';
import type { z } from 'zod';

type PartnerType = z.infer<typeof PartnerTypeSchema>;

interface UsePartnerMutationsOptions {
  /** Partner type for create operation */
  type: PartnerType;
  /** Callback after successful mutation */
  onSuccess?: () => void;
}

interface CreatePartnerData {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

/**
 * Shared hook for partner create/delete mutations.
 * Works with both Customer and Supplier.
 *
 * @example
 * const { handleCreate, handleDelete, isCreating, isDeleting } = usePartnerMutations({
 *   type: 'CUSTOMER',
 *   onSuccess: () => utils.partner.list.invalidate()
 * });
 */
export function usePartnerMutations({
  type,
  onSuccess,
}: UsePartnerMutationsOptions) {
  const confirm = useConfirm();

  const createMutation = trpc.partner.create.useMutation({
    onSuccess,
  });

  const deleteMutation = trpc.partner.delete.useMutation({
    onSuccess,
  });

  const entityLabel =
    type === PartnerTypeSchema.enum.CUSTOMER
      ? 'Customer'
      : 'Supplier';

  const handleCreate = async (data: CreatePartnerData) => {
    return apiAction(
      () => createMutation.mutateAsync({ ...data, type }),
      `${entityLabel} created!`
    );
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: `Delete ${entityLabel}`,
      message: `Are you sure you want to delete this ${entityLabel.toLowerCase()}?`,
      confirmText: 'Yes, Delete',
      variant: 'danger',
    });
    if (!confirmed) return;
    await apiAction(
      () => deleteMutation.mutateAsync({ id }),
      `${entityLabel} deleted`
    );
  };

  return {
    handleCreate,
    handleDelete,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
