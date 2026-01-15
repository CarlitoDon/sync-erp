import { useState } from 'react';
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

interface CreateApiKeyModalProps {
  open: boolean;
  onClose: () => void;
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
}: CreateApiKeyModalProps) {
  const [generatedKey, setGeneratedKey] = useState<string | null>(
    null
  );
  const [copied, setCopied] = useState(false);
  const utils = trpc.useUtils();

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

  const createMutation = trpc.apiKey.create.useMutation({
    onSuccess: (data) => {
      setGeneratedKey(data.key);
      utils.apiKey.list.invalidate();
      utils.apiKey.getStats.invalidate();
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
    await createMutation.mutateAsync({
      name: data.name,
      webhookUrl: data.webhookUrl || undefined,
      rateLimit: data.rateLimit,
      expiresInDays: data.expiresInDays || undefined,
    });
  };

  const handleClose = () => {
    setGeneratedKey(null);
    setCopied(false);
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {generatedKey ? 'API Key Created' : 'Create API Key'}
          </DialogTitle>
        </DialogHeader>

        {generatedKey ? (
          /* Success State - Show Key */
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
                  size="icon"
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending
                  ? 'Creating...'
                  : 'Generate Key'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
