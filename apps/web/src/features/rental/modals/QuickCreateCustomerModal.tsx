import React, { useState } from 'react';
import FormModal from '@/components/ui/FormModal';
import { Input } from '@/components/ui';
import { trpc } from '@/lib/trpc';
import { apiAction } from '@/hooks/useApiAction';
import { PartnerType } from '@sync-erp/shared';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (partnerId: string) => void;
}

export default function QuickCreateCustomerModal({
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
  });

  const createMutation = trpc.partner.create.useMutation({
    onSuccess: (data) => {
      utils.partner.list.invalidate();
      onSuccess(data.id);
      handleClose();
    },
  });

  const handleClose = () => {
    setForm({ name: '', phone: '', address: '' });
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
          address: form.address || undefined,
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
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nama Customer *"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Masukkan nama customer"
          required
          autoFocus
        />
        <Input
          label="No. Telepon"
          value={form.phone}
          onChange={(e) =>
            setForm({ ...form, phone: e.target.value })
          }
          placeholder="08xx-xxxx-xxxx"
        />
        <Input
          label="Alamat"
          value={form.address}
          onChange={(e) =>
            setForm({ ...form, address: e.target.value })
          }
          placeholder="Alamat lengkap"
        />

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 bg-gray-100 rounded-lg"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending || !form.name.trim()}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50"
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
