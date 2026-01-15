import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
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
import {
  DocumentDuplicateIcon,
  ExclamationTriangleIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { useForm } from 'react-hook-form';

export interface ApiKeyData {
  id: string;
  name: string;
  rateLimit: number;
  webhookUrl?: string | null;
}

interface CreateApiKeyModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: ApiKeyData | null;
}

interface FormData {
  name: string;
  webhookUrl?: string;
  rateLimit: number;
  expiresInDays?: number;
}

export function CreateApiKeyModal({
  open,
  onClose,
  initialData,
}: CreateApiKeyModalProps) {
  const [generatedKey, setGeneratedKey] = useState<string | null>(
    null
  );
  const [copied, setCopied] = useState(false);
  const utils = trpc.useUtils();
  const isEditMode = !!initialData;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      rateLimit: 1000,
    },
  });

  // Reset form when opening/closing or changing mode
  useEffect(() => {
    if (open) {
      if (initialData) {
        reset({
          name: initialData.name,
          webhookUrl: initialData.webhookUrl || '',
          rateLimit: initialData.rateLimit,
        });
      } else {
        reset({
          name: '',
          webhookUrl: '',
          rateLimit: 1000,
          expiresInDays: undefined,
        });
        setGeneratedKey(null);
      }
    }
  }, [open, initialData, reset]);

  const createMutation = trpc.apiKey.create.useMutation({
    onSuccess: (data) => {
      setGeneratedKey(data.key);
      utils.apiKey.list.invalidate();
      utils.apiKey.getStats.invalidate();
    },
  });

  const updateMutation = trpc.apiKey.update.useMutation({
    onSuccess: () => {
      utils.apiKey.list.invalidate();
      utils.apiKey.getStats.invalidate();
      handleClose();
    },
  });

  const handleCopy = async () => {
    if (generatedKey) {
      await navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (isEditMode && initialData) {
      await updateMutation.mutateAsync({
        keyId: initialData.id,
        name: data.name,
        rateLimit: data.rateLimit,
        webhookUrl: data.webhookUrl || null,
      });
    } else {
      await createMutation.mutateAsync({
        name: data.name,
        webhookUrl: data.webhookUrl || undefined,
        rateLimit: data.rateLimit,
        expiresInDays: data.expiresInDays || undefined,
      });
    }
  };

  const handleClose = () => {
    setGeneratedKey(null);
    setCopied(false);
    reset();
    onClose();
  };

  const isPending =
    createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {generatedKey
              ? 'API Key Created'
              : isEditMode
                ? 'Edit API Key'
                : 'Create API Key'}
          </DialogTitle>
        </DialogHeader>

        {generatedKey ? (
          /* Success State - Show Key (Only for Create) */
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-md flex gap-3 text-sm">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-medium">Save this key now!</p>
                <p>
                  You won't be able to see it again. Store it
                  securely.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex gap-2">
                <Input
                  value={generatedKey}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="p-0 h-8 w-8"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <CheckIcon className="h-4 w-4 text-green-500" />
                  ) : (
                    <DocumentDuplicateIcon className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* Form State */
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="name">Key Name *</Label>
              <Input
                id="name"
                placeholder="Production API Key"
                {...register('name', {
                  required: 'Name is required',
                })}
              />
              {errors.name && (
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Webhook URL - Only show on Create. Edit wraps to separate config or ignore for now as requested.
                Actually, implementation plan says "Use Update procedure".
                Router update doesn't include webhookUrl (separate endpoint).
                So hide Webhook URL in edit mode to avoid confusion.
            */}
            <div className="space-y-2">
              <Label htmlFor="webhookUrl">
                Webhook URL (optional)
              </Label>
              <Input
                id="webhookUrl"
                placeholder="https://your-app.com/webhooks/sync-erp"
                {...register('webhookUrl')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rateLimit">Rate Limit (per hour)</Label>
              <Input
                id="rateLimit"
                type="number"
                {...register('rateLimit', {
                  valueAsNumber: true,
                  min: { value: 100, message: 'Minimum 100' },
                  max: { value: 10000, message: 'Maximum 10000' },
                })}
              />
              {errors.rateLimit && (
                <p className="text-sm text-destructive">
                  {errors.rateLimit.message}
                </p>
              )}
            </div>

            {!isEditMode && (
              <div className="space-y-2">
                <Label htmlFor="expiresInDays">
                  Expires In (days, optional)
                </Label>
                <Input
                  id="expiresInDays"
                  type="number"
                  placeholder="Leave empty for no expiration"
                  {...register('expiresInDays', {
                    valueAsNumber: true,
                  })}
                />
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? 'Saving...'
                  : isEditMode
                    ? 'Save Changes'
                    : 'Generate Key'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
