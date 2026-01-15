import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useApiAction } from '@/hooks/useApiAction';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
} from '@/components/ui';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { CreateApiKeyModal } from '../components/CreateApiKeyModal';

function timeAgo(date: Date): string {
  const seconds = Math.floor(
    (new Date().getTime() - new Date(date).getTime()) / 1000
  );

  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + ' years ago';

  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + ' months ago';

  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + ' days ago';

  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + ' hours ago';

  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + ' minutes ago';

  return Math.floor(seconds) + ' seconds ago';
}

export default function ApiKeysPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const utils = trpc.useUtils();

  const { data: stats, isLoading: statsLoading } =
    trpc.apiKey.getStats.useQuery();
  const { data: keys, isLoading: keysLoading } =
    trpc.apiKey.list.useQuery();

  const revokeMutation = trpc.apiKey.revoke.useMutation({
    onSuccess: () => {
      utils.apiKey.list.invalidate();
      utils.apiKey.getStats.invalidate();
    },
  });

  const { apiAction } = useApiAction();

  const handleRevoke = async (keyId: string, keyName: string) => {
    if (
      !confirm(
        `Are you sure you want to revoke "${keyName}"? This cannot be undone.`
      )
    ) {
      return;
    }
    await apiAction(
      () => revokeMutation.mutateAsync({ keyId }),
      'API key revoked'
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="text-muted-foreground">
            Manage API keys for external integrations
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Create API Key
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Keys
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : (stats?.activeKeys ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Orders (30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : (stats?.ordersLast30Days ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Keys
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : (stats?.totalKeys ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Keys Table */}
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="border-b transition-colors data-[state=selected]:bg-muted">
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                    Name
                  </th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                    Key
                  </th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                    Webhook
                  </th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                    Last Used
                  </th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {keysLoading && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center">
                      Loading...
                    </td>
                  </tr>
                )}
                {keys?.length === 0 && !keysLoading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-4 text-center text-muted-foreground"
                    >
                      No API keys found
                    </td>
                  </tr>
                )}
                {keys?.map((key) => (
                  <tr
                    key={key.id}
                    className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                  >
                    <td className="p-4 align-middle font-medium">
                      {key.name}
                    </td>
                    <td className="p-4 align-middle">
                      <code className="bg-muted px-2 py-1 rounded text-xs">
                        {key.keyPrefix}...
                      </code>
                    </td>
                    <td className="p-4 align-middle">
                      <Badge
                        variant={
                          key.isActive ? 'default' : 'destructive'
                        }
                      >
                        {key.isActive ? 'Active' : 'Revoked'}
                      </Badge>
                    </td>
                    <td className="p-4 align-middle">
                      {key.webhookUrl ? (
                        <span
                          className="text-xs text-muted-foreground truncate max-w-[200px] block"
                          title={key.webhookUrl}
                        >
                          {key.webhookUrl}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Not configured
                        </span>
                      )}
                    </td>
                    <td className="p-4 align-middle">
                      {key.lastUsedAt ? (
                        <span className="text-sm">
                          {timeAgo(key.lastUsedAt)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          Never
                        </span>
                      )}
                    </td>
                    <td className="p-4 align-middle text-right">
                      {key.isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleRevoke(key.id, key.name)
                          }
                        >
                          <TrashIcon className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create Modal */}
      <CreateApiKeyModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}
