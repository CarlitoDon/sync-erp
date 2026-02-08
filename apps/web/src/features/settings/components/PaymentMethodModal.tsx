import { useEffect, useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { apiAction } from '@/hooks/useApiAction';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
} from '@/components/ui';
import Select from '@/components/ui/Select';
import {
  PaymentMethodType,
  PAYMENT_METHOD_TYPE_OPTIONS,
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

type Props = {
  open: boolean;
  onClose: () => void;
  initialData: PaymentMethodData | null;
};

export function PaymentMethodModal({
  open,
  onClose,
  initialData,
}: Props) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<PaymentMethodType>('BANK');
  const [accountId, setAccountId] = useState<string>('');
  const [isDefault, setIsDefault] = useState(false);

  const utils = trpc.useUtils();

  // Get accounts for dropdown
  const { data: accounts } = trpc.finance.listAccounts.useQuery();

  // Filter to only Cash & Bank accounts (codes starting with 11xx or 12xx)
  // Exclude header accounts: 1100, 1200, 1210
  const cashBankAccounts = useMemo(() => {
    if (!accounts) return [];
    const headerCodes = ['1100', '1200', '1210'];
    return accounts.filter((acc) => {
      const code = acc.code;
      // Exclude header accounts
      if (headerCodes.includes(code)) return false;
      // Cash accounts: 1101-1199, Bank accounts: 1201-1299 (excluding 1210)
      return (
        (code >= '1100' && code <= '1199') ||
        (code >= '1200' && code <= '1299')
      );
    });
  }, [accounts]);

  const createMutation = trpc.paymentMethod.create.useMutation({
    onSuccess: () => {
      utils.paymentMethod.list.invalidate();
      onClose();
    },
  });

  const updateMutation = trpc.paymentMethod.update.useMutation({
    onSuccess: () => {
      utils.paymentMethod.list.invalidate();
      onClose();
    },
  });

  useEffect(() => {
    if (initialData) {
      setCode(initialData.code);
      setName(initialData.name);
      setType(initialData.type);
      setAccountId(initialData.accountId || '');
      setIsDefault(initialData.isDefault || false);
    } else {
      setCode('');
      setName('');
      setType('BANK');
      setAccountId('');
      setIsDefault(false);
    }
  }, [initialData, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      code: code.toUpperCase().replace(/\s+/g, '_'),
      name,
      type,
      accountId: accountId || null,
      isDefault,
    };

    if (initialData?.id) {
      await apiAction(
        () =>
          updateMutation.mutateAsync({ id: initialData.id!, data }),
        'Metode pembayaran diperbarui'
      );
    } else {
      await apiAction(
        () => createMutation.mutateAsync(data),
        'Metode pembayaran dibuat'
      );
    }
  };

  const isLoading =
    createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {initialData?.id ? 'Edit' : 'Tambah'} Metode Pembayaran
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Kode</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="QRIS_BCA"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nama</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="QRIS BCA"
                required
              />
            </div>
          </div>

          <Select
            label="Tipe"
            value={type}
            onChange={(val) => setType(val as PaymentMethodType)}
            options={PAYMENT_METHOD_TYPE_OPTIONS}
          />

          <div>
            <Select
              label="Akun GL (Kas/Bank)"
              value={accountId}
              onChange={setAccountId}
              placeholder="-- Tidak ada --"
              options={cashBankAccounts.map((acc) => ({
                value: acc.id,
                label: `${acc.code} - ${acc.name}`,
              }))}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Akun yang akan di-debit saat menerima pembayaran
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="isDefault">
              Jadikan default untuk tipe ini
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
