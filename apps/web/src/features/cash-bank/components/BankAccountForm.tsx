import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useBankAccounts } from '../hooks';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import FormModal from '@/components/ui/FormModal';
import { CreateBankAccountInput } from '@sync-erp/shared';

interface BankAccountFormProps {
  isOpen: boolean;
  onClose: () => void;
  accountId?: string; // If provided, we are in Edit mode
  onSuccess?: () => void;
}

export default function BankAccountForm({
  isOpen,
  onClose,
  accountId,
  onSuccess,
}: BankAccountFormProps) {
  // const { currentCompany } = useCompany(); // Removing unused
  const { createAccount, updateAccount, isCreating, isUpdating } =
    useBankAccounts();
  /* Removed activeTab and listAccounts query as they are no longer needed for auto-generated sub-accounts */

  const { register, handleSubmit, setValue, reset } =
    useForm<CreateBankAccountInput>({
      defaultValues: {
        bankName: '',
        accountNumber: '',
        currency: 'IDR',
      },
    });

  const { data: existingAccount } = trpc.cashBank.getAccount.useQuery(
    accountId!,
    {
      enabled: !!accountId && isOpen,
    }
  );

  useEffect(() => {
    if (existingAccount) {
      setValue('bankName', existingAccount.bankName);
      setValue('accountNumber', existingAccount.accountNumber || '');
      setValue('currency', existingAccount.currency);
      // In edit mode, we don't allow changing GL account links usually for simplicity in MVP
    }
  }, [existingAccount, setValue]);

  useEffect(() => {
    if (!isOpen) {
      reset();
    }
  }, [isOpen, reset]);

  const onSubmit = async (data: CreateBankAccountInput) => {
    let result;
    if (accountId) {
      result = await updateAccount(accountId, {
        bankName: data.bankName,
        accountNumber: data.accountNumber,
      });
    } else {
      // For creation, data already includes accountType
      result = await createAccount(data);
    }

    if (result) {
      onSuccess?.();
      onClose();
    }
  };

  const isEdit = !!accountId;
  const isLoading = isCreating || isUpdating;

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Bank Account' : 'New Bank/Cash Account'}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-4">
          <div>
            <Label>Display Name *</Label>
            <Input
              {...register('bankName', { required: true })}
              placeholder="e.g. BCA Business, Petty Cash"
              autoFocus
            />
          </div>

          <div>
            <Label>Account Number (Optional)</Label>
            <Input
              {...register('accountNumber')}
              placeholder="e.g. 123-456-789"
            />
          </div>

          <div>
            <Label>Currency</Label>
            <Input
              {...register('currency')}
              value="IDR"
              disabled
              className="bg-gray-50"
            />
          </div>

          {!isEdit && (
            <div className="pt-2 space-y-3">
              <Label className="block">Account Type</Label>
              <div className="grid grid-cols-2 gap-4">
                <label className="border rounded-lg p-3 cursor-pointer hover:bg-gray-50 flex items-center gap-2">
                  <input
                    type="radio"
                    value="BANK"
                    {...register('accountType')}
                    className="w-4 h-4 text-primary-600"
                  />
                  <span>Bank Account</span>
                </label>
                <label className="border rounded-lg p-3 cursor-pointer hover:bg-gray-50 flex items-center gap-2">
                  <input
                    type="radio"
                    value="CASH"
                    {...register('accountType')}
                    className="w-4 h-4 text-primary-600"
                  />
                  <span>Cash Account</span>
                </label>
              </div>
              <p className="text-xs text-gray-500">
                This will automatically create a sub-account in the
                Chart of Accounts (under 1200 for Bank, 1100 for
                Cash).
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isLoading}
            loadingText={isEdit ? 'Updating...' : 'Creating...'}
          >
            {isEdit ? 'Save Changes' : 'Create Account'}
          </Button>
        </div>
      </form>
    </FormModal>
  );
}
