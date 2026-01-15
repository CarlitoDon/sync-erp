import { useParams } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Input, Label } from '@/components/ui';
import { toast } from 'react-hot-toast';
import { useState } from 'react';
import {
  DocumentDuplicateIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

const SimpleSwitch = ({
  checked,
  onCheckedChange,
  id,
}: {
  checked: boolean;
  onCheckedChange: (c: boolean) => void;
  id: string;
}) => (
  <button
    id={id}
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onCheckedChange(!checked)}
    className={`${
      checked ? 'bg-indigo-600' : 'bg-gray-200'
    } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2`}
  >
    <span
      aria-hidden="true"
      className={`${
        checked ? 'translate-x-5' : 'translate-x-0'
      } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
    />
  </button>
);

export default function IntegrationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const utils = trpc.useUtils();

  const { data: integration, isLoading } =
    trpc.integration.get.useQuery({ id: id! }, { enabled: !!id });

  const updateMutation = trpc.integration.update.useMutation({
    onSuccess: () => {
      toast.success('Configuration updated');
      utils.integration.get.invalidate({ id });
    },
  });

  const rotateKeyMutation = trpc.integration.rotateKey.useMutation({
    onSuccess: (data) => {
      setNewKey(data.key); // Show the new key once
      toast.success('New API Key generated');
      utils.integration.get.invalidate({ id });
    },
  });

  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Form State
  const [webhookUrl, setWebhookUrl] = useState('');

  // Sync form with data when loaded
  if (integration && webhookUrl === '' && integration.config) {
    const config = integration.config as any;
    if (config.webhookUrl) setWebhookUrl(config.webhookUrl);
  }

  const handleSaveConfig = () => {
    if (!integration) return;
    updateMutation.mutate({
      id: integration.id,
      config: {
        ...(integration.config as object),
        webhookUrl,
      },
    });
  };

  const handleToggleActive = (checked: boolean) => {
    if (!integration) return;
    updateMutation.mutate({
      id: integration.id,
      isActive: checked,
    });
  };

  const handleRotateKey = () => {
    if (
      confirm('Are you sure? Old keys will stop working immediately.')
    ) {
      rotateKeyMutation.mutate({ integrationId: integration!.id });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) return <div>Loading...</div>;
  if (!integration) return <div>Integration not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title={integration.name}
          description="Configure integration settings and credentials."
        />
        <div className="flex items-center gap-2">
          <Label htmlFor="active-mode">Active</Label>
          <SimpleSwitch
            id="active-mode"
            checked={integration.isActive}
            onCheckedChange={handleToggleActive}
          />
        </div>
      </div>

      <div className="space-y-4">
        {/* Simple Tabs Header */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {['overview', 'settings', 'credentials'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`${
                  activeTab === tab
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === 'overview' && (
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-medium mb-2">
              About {integration.name}
            </h3>
            <p className="text-gray-600">{integration.description}</p>

            <div className="mt-8">
              <h4 className="font-medium mb-2">Capabilities</h4>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                <li>Read Rental Products</li>
                <li>Create Orders</li>
                <li>Receive Order Updates (via Webhooks)</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-6">
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <Input
                placeholder="https://your-app.com/api/webhooks"
                value={webhookUrl}
                onChange={(e: any) => setWebhookUrl(e.target.value)}
              />
              <p className="text-sm text-gray-500">
                We will send order updates to this URL.
              </p>
            </div>

            <Button
              onClick={handleSaveConfig}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending
                ? 'Saving...'
                : 'Save Configuration'}
            </Button>
          </div>
        )}

        {activeTab === 'credentials' && (
          <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-6">
            {newKey && (
              <div className="bg-green-50 border border-green-200 p-4 rounded-md">
                <h4 className="text-green-800 font-medium mb-1">
                  New Key Generated
                </h4>
                <p className="text-green-700 text-sm mb-3">
                  Copy this key now. You won't be able to see it
                  again!
                </p>
                <div className="flex gap-2">
                  <Input
                    value={newKey}
                    readOnly
                    className="font-mono bg-white"
                  />
                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(newKey)}
                  >
                    {copied ? (
                      'Copied!'
                    ) : (
                      <DocumentDuplicateIcon className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="font-medium">Active API Keys</h3>
              {integration.apiKeys.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No active keys.
                </p>
              ) : (
                <div className="space-y-2">
                  {integration.apiKeys.map((key: any) => (
                    <div
                      key={key.id}
                      className="flex justify-between items-center p-3 bg-gray-50 rounded border"
                    >
                      <div className="flex flex-col">
                        <span className="font-mono text-sm font-medium">
                          {key.keyPrefix}...
                        </span>
                        <span className="text-xs text-gray-500">
                          Last used:{' '}
                          {key.lastUsedAt
                            ? new Date(
                                key.lastUsedAt
                              ).toLocaleString()
                            : 'Never'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t">
              <Button
                variant="danger"
                onClick={handleRotateKey}
                disabled={rotateKeyMutation.isPending}
              >
                <ArrowPathIcon className="w-4 h-4 mr-2" />
                Roll Key (Regenerate)
              </Button>
              <p className="text-xs text-red-500 mt-2">
                Generating a new key will NOT automatically invalidate
                old ones unless specified (current logic keeps them
                but frontend suggests replacement).
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
