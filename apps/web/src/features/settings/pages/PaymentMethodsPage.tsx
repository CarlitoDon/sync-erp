import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { apiAction } from '@/hooks/useApiAction';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
} from '@/components/ui';
import {
  PlusIcon,
  TrashIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import { PaymentMethodModal } from '../components/PaymentMethodModal';
import {
  PaymentMethodType,
  PAYMENT_METHOD_TYPE_COLORS,
  PAYMENT_METHOD_TYPE_LABELS,
} from '../paymentMethodTypes';

type PaymentMethodData = {
  id?: string;
  code: string;
  name: string;
  type: PaymentMethodType;
  accountId?: string | null;
  isDefault?: boolean;
  sortOrder?: number;
};

export default function PaymentMethodsPage() {
  const [showModal, setShowModal] = useState(false);
  const [editingMethod, setEditingMethod] =
    useState<PaymentMethodData | null>(null);
  const utils = trpc.useUtils();

  const { data: methods, isLoading } =
    trpc.paymentMethod.list.useQuery({
      includeInactive: true,
    });

  const deleteMutation = trpc.paymentMethod.delete.useMutation({
    onSuccess: () => {
      utils.paymentMethod.list.invalidate();
    },
  });

  const seedMutation = trpc.paymentMethod.seedDefaults.useMutation({
    onSuccess: () => {
      utils.paymentMethod.list.invalidate();
    },
  });

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus metode pembayaran "${name}"?`)) return;
    await apiAction(
      () => deleteMutation.mutateAsync({ id }),
      'Metode pembayaran dihapus'
    );
  };

  const handleCreate = () => {
    setEditingMethod(null);
    setShowModal(true);
  };

  const handleEdit = (method: PaymentMethodData) => {
    setEditingMethod(method);
    setShowModal(true);
  };

  const handleSeedDefaults = async () => {
    await apiAction(
      () => seedMutation.mutateAsync(),
      'Default payment methods created'
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Metode Pembayaran</h1>
          <p className="text-muted-foreground">
            Kelola metode pembayaran untuk jurnal akuntansi
          </p>
        </div>
        <div className="flex gap-2">
          {methods?.length === 0 && (
            <Button variant="outline" onClick={handleSeedDefaults}>
              Buat Default
            </Button>
          )}
          <Button onClick={handleCreate}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Tambah Metode
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Metode Pembayaran</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="border-b">
                  <th className="h-12 px-4 text-left font-medium text-muted-foreground">
                    Kode
                  </th>
                  <th className="h-12 px-4 text-left font-medium text-muted-foreground">
                    Nama
                  </th>
                  <th className="h-12 px-4 text-left font-medium text-muted-foreground">
                    Tipe
                  </th>
                  <th className="h-12 px-4 text-left font-medium text-muted-foreground">
                    Akun GL
                  </th>
                  <th className="h-12 px-4 text-left font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="h-12 px-4 text-left font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {isLoading && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center">
                      Loading...
                    </td>
                  </tr>
                )}
                {methods?.length === 0 && !isLoading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-4 text-center text-muted-foreground"
                    >
                      Belum ada metode pembayaran
                    </td>
                  </tr>
                )}
                {methods?.map((method) => (
                  <tr
                    key={method.id}
                    className="border-b hover:bg-muted/50"
                  >
                    <td className="p-4 font-mono text-sm">
                      {method.code}
                    </td>
                    <td className="p-4 font-medium">
                      {method.name}
                      {method.isDefault && (
                        <Badge
                          variant="outline"
                          className="ml-2 text-xs"
                        >
                          Default
                        </Badge>
                      )}
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={
                          PAYMENT_METHOD_TYPE_COLORS[method.type] ||
                          'outline'
                        }
                      >
                        {PAYMENT_METHOD_TYPE_LABELS[method.type] ||
                          method.type}
                      </Badge>
                    </td>
                    <td className="p-4 text-sm">
                      {method.account ? (
                        <span className="font-mono">
                          {method.account.code} -{' '}
                          {method.account.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          -
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={
                          method.isActive ? 'default' : 'secondary'
                        }
                      >
                        {method.isActive ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleEdit({
                            id: method.id,
                            code: method.code,
                            name: method.name,
                            type: method.type,
                            accountId: method.accountId,
                            isDefault: method.isDefault,
                            sortOrder: method.sortOrder,
                          })
                        }
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleDelete(method.id, method.name)
                        }
                      >
                        <TrashIcon className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <PaymentMethodModal
        open={showModal}
        onClose={() => setShowModal(false)}
        initialData={editingMethod}
      />
    </div>
  );
}
