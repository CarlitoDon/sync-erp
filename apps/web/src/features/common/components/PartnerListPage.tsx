import { useState, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/contexts/CompanyContext';
import { apiAction } from '@/hooks/useApiAction';
import { useConfirm } from '@/components/ui/ConfirmModal';
import ActionButton from '@/components/ui/ActionButton';
import FormModal from '@/components/ui/FormModal';
import { PartnerTypeSchema } from '@sync-erp/shared';
import { PageContainer, PageHeader } from '@/components/layout/PageLayout';
import { Card } from '@/components/ui/Card';
import { LoadingState, NoCompanySelected, Input } from '@/components/ui';

type PartnerType = typeof PartnerTypeSchema.enum.SUPPLIER | typeof PartnerTypeSchema.enum.CUSTOMER;

interface CreatePartnerInput {
  name: string;
  email: string;
  phone: string;
  address: string;
  type: PartnerType;
}

interface Partner {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export interface PartnerListPageProps {
  /** Partner type to filter by */
  type: PartnerType;
  /** Singular label (e.g., "Supplier", "Customer") */
  label: string;
  /** Plural label (e.g., "Suppliers", "Customers") */
  labelPlural: string;
  /** Base path for detail links (e.g., "/suppliers", "/customers") */
  basePath: string;
}

/**
 * Memoized table row component to prevent unnecessary re-renders.
 */
const PartnerRow = memo(function PartnerRow({
  partner,
  basePath,
  onDelete,
}: {
  partner: Partner;
  basePath: string;
  onDelete: (id: string) => void;
}) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 font-medium text-gray-900">
        <Link
          to={`${basePath}/${partner.id}`}
          className="text-blue-600 hover:underline"
        >
          {partner.name}
        </Link>
      </td>
      <td className="px-6 py-4 text-gray-500">{partner.email || '-'}</td>
      <td className="px-6 py-4 text-gray-500">{partner.phone || '-'}</td>
      <td className="px-6 py-4 text-gray-500">{partner.address || '-'}</td>
      <td className="px-6 py-4 text-right">
        <ActionButton onClick={() => onDelete(partner.id)} variant="danger">
          Delete
        </ActionButton>
      </td>
    </tr>
  );
});

/**
 * Shared partner list page component for Suppliers and Customers.
 * Handles listing, creating, and deleting partners of a specific type.
 */
export default function PartnerListPage({
  type,
  label,
  labelPlural,
  basePath,
}: PartnerListPageProps) {
  const { currentCompany } = useCompany();
  const confirm = useConfirm();
  const utils = trpc.useUtils();

  const { data: partners = [], isLoading: loading } = trpc.partner.list.useQuery(
    { type },
    { enabled: !!currentCompany?.id }
  );

  const createMutation = trpc.partner.create.useMutation({
    onSuccess: () => {
      utils.partner.list.invalidate();
    },
  });

  const deleteMutation = trpc.partner.delete.useMutation({
    onSuccess: () => {
      utils.partner.list.invalidate();
    },
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<CreatePartnerInput>({
    name: '',
    email: '',
    phone: '',
    address: '',
    type,
  });

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      type,
    });
  }, [type]);

  const handleClose = useCallback(() => {
    setIsModalOpen(false);
    resetForm();
  }, [resetForm]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    await apiAction(
      () => createMutation.mutateAsync(formData),
      `${label} created!`
    );
    handleClose();
  }, [createMutation, formData, label, handleClose]);

  const handleDelete = useCallback(async (id: string) => {
    const confirmed = await confirm({
      title: `Delete ${label}`,
      message: `Are you sure you want to delete this ${label.toLowerCase()}?`,
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;
    await apiAction(
      () => deleteMutation.mutateAsync({ id }),
      `${label} deleted`
    );
  }, [confirm, deleteMutation, label]);

  if (loading) {
    return <LoadingState />;
  }

  if (!currentCompany) {
    return (
      <NoCompanySelected
        message={`Please select a company to view ${labelPlural.toLowerCase()}.`}
      />
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={labelPlural}
        description={`Manage your ${label.toLowerCase()} relationships for ${currentCompany.name}`}
        actions={
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            + Add {label}
          </button>
        }
      />

      {/* Modal Form */}
      <FormModal
        isOpen={isModalOpen}
        onClose={handleClose}
        title={`New ${label}`}
      >
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <Input
            label="Name"
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <Input
            label="Phone"
            type="text"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          <Input
            label="Address"
            type="text"
            value={formData.address}
            onChange={(e) =>
              setFormData({
                ...formData,
                address: e.target.value,
              })
            }
          />
          <div className="col-span-2 flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Create {label}
            </button>
          </div>
        </form>
      </FormModal>

      <Card className="overflow-hidden">
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
                Phone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Address
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {partners.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No {labelPlural.toLowerCase()} found for this company.
                </td>
              </tr>
            ) : (
              partners.map((partner) => (
                <PartnerRow
                  key={partner.id}
                  partner={partner}
                  basePath={basePath}
                  onDelete={handleDelete}
                />
              ))
            )}
          </tbody>
        </table>
      </Card>
    </PageContainer>
  );
}
