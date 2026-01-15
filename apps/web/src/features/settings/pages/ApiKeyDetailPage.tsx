import { trpc } from '@/lib/trpc';
import { useApiAction } from '@/hooks/useApiAction';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Input,
  Label,
} from '@/components/ui';
import { useParams, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useForm } from 'react-hook-form';
import {
  ArrowLeftIcon,
  TrashIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';

// Simplified timeAgo since we removed date-fns
function timeAgo(date: Date): string {
  const seconds = Math.floor(
    (new Date().getTime() - new Date(date).getTime()) / 1000
  );
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface WebhookFormData {
  webhookUrl: string;
}

export default function ApiKeyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { apiAction } = useApiAction();
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // We need to fetch the key details.
  // currently we only have 'list'. We should add a 'get' endpoint or just filter from list if we want to save time.
  // Best practice is a get endpoint. But strict requirements say "edit current file".
  // I will check if list returns enough info. Yes it does.
  // Alternatively I can add get endpoint to backend, but user said "focus internal sync erp" presumably meaning finish what's there.
  // Actually, I can just use list and find by ID for now to save backend turn.

  const { data: keys, isLoading } = trpc.apiKey.list.useQuery();
  const key = keys?.find((k) => k.id === id);

  const updateWebhookMutation = trpc.apiKey.updateWebhook.useMutation(
    {
      onSuccess: () => {
        utils.apiKey.list.invalidate();
        alert('Webhook configuration updated');
      },
    }
  );

  const revokeMutation = trpc.apiKey.revoke.useMutation({
    onSuccess: () => {
      utils.apiKey.list.invalidate();
      navigate('/settings/api-keys');
    },
  });

  const testWebhookMutation = trpc.apiKey.testWebhook.useMutation();

  const { register, handleSubmit } = useForm<WebhookFormData>({
    values: {
      webhookUrl: key?.webhookUrl || '',
    },
  });

  const onSubmitWebhook = async (data: WebhookFormData) => {
    if (!key) return;
    await apiAction(
      () =>
        updateWebhookMutation.mutateAsync({
          keyId: key.id,
          webhookUrl: data.webhookUrl || null,
        }),
      'Webhook updated'
    );
  };

  const handleTestWebhook = async (data: WebhookFormData) => {
    if (!data.webhookUrl) return;
    try {
      setTestResult({ success: false, message: 'Testing...' });
      const result = await testWebhookMutation.mutateAsync({
        webhookUrl: data.webhookUrl,
      });
      setTestResult({
        success: true,
        message: `Success! Latency: ${result.latencyMs}ms`,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Failed: ${err.message}`,
      });
    }
  };

  const handleRevoke = async () => {
    if (!key) return;
    if (
      !confirm(
        'Are you sure? This API key will stop working immediately.'
      )
    )
      return;
    await apiAction(
      () => revokeMutation.mutateAsync({ keyId: key.id }),
      'API key revoked'
    );
  };

  if (isLoading) return <div>Loading...</div>;
  if (!key) return <div>API Key not found</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/settings/api-keys')}
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{key.name}</h1>
          <p className="text-muted-foreground font-mono text-sm">
            {key.keyPrefix}...
          </p>
        </div>
        <div className="ml-auto">
          <Badge variant={key.isActive ? 'default' : 'destructive'}>
            {key.isActive ? 'Active' : 'Revoked'}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Created</span>
              <span>
                {new Date(key.createdAt).toLocaleDateString()}
              </span>

              <span className="text-muted-foreground">Expires</span>
              <span>
                {key.expiresAt
                  ? new Date(key.expiresAt).toLocaleDateString()
                  : 'Never'}
              </span>

              <span className="text-muted-foreground">Last Used</span>
              <span>
                {key.lastUsedAt ? timeAgo(key.lastUsedAt) : 'Never'}
              </span>

              <span className="text-muted-foreground">
                Rate Limit
              </span>
              <span>{key.rateLimit} req/hr</span>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">
                Permissions
              </h4>
              <div className="flex flex-wrap gap-2">
                {key.permissions.map((perm) => (
                  <Badge
                    key={perm}
                    variant="outline"
                    className="font-mono text-xs"
                  >
                    {perm}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Webhook Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Webhook Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit(onSubmitWebhook)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <Input
                  {...register('webhookUrl')}
                  placeholder="https://..."
                  disabled={!key.isActive}
                />
              </div>

              {testResult && (
                <div
                  className={`text-sm p-2 rounded ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
                >
                  {testResult.message}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={
                    !key.isActive || updateWebhookMutation.isPending
                  }
                >
                  Save Changes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSubmit(handleTestWebhook)}
                  disabled={
                    !key.isActive || testWebhookMutation.isPending
                  }
                >
                  <ClipboardDocumentCheckIcon className="h-4 w-4 mr-2" />
                  Test
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {key.isActive && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-900">
              Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-700 mb-4">
              Revoking this API key will immediately block all
              requests using it. This action cannot be undone.
            </p>
            <Button variant="destructive" onClick={handleRevoke}>
              <TrashIcon className="h-4 w-4 mr-2" />
              Revoke API Key
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
