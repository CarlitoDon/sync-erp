import React, { useState } from 'react';
import FormModal from '@/components/ui/FormModal';
import { Input } from '@/components/ui';
import { trpc } from '@/lib/trpc';
import { apiAction } from '@/hooks/useApiAction';
import { PartnerType } from '@sync-erp/shared';

export interface CreatedCustomerData {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (customer: CreatedCustomerData) => void;
  zIndex?: string;
}

export default function QuickCreateCustomerModal({
  isOpen,
  onClose,
  onSuccess,
  zIndex = 'z-[60]',
}: Props) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    name: '',
    phone: '',
  });

  const createMutation = trpc.partner.create.useMutation({
    onSuccess: (data) => {
      utils.partner.list.invalidate();
      onSuccess({
        id: data.id,
        name: data.name,
        phone: data.phone,
      });
      handleClose();
    },
  });

  const handleClose = () => {
    setForm({ name: '', phone: '' });
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    await apiAction(
      () =>
        createMutation.mutateAsync({
          name: form.name,
          phone: form.phone || undefined,
          type: PartnerType.CUSTOMER,
        }),
      'Customer berhasil ditambahkan'
    );
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Tambah Customer Baru"
      zIndex={zIndex}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nama Customer"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Masukkan nama customer"
          required
          autoFocus
        />
        <Input
          label="No. Telepon / WhatsApp"
          value={form.phone}
          onChange={(e) =>
            setForm({ ...form, phone: e.target.value })
          }
          placeholder="08xx-xxxx-xxxx"
        />

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 bg-gray-100 rounded-lg text-sm text-slate-700 hover:bg-gray-200 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending || !form.name.trim()}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary-700 transition-colors"
          >
            {createMutation.isPending
              ? 'Menyimpan...'
              : 'Tambah Customer'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
