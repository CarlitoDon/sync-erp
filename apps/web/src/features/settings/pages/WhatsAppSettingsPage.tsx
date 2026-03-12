import { trpc } from '@/lib/trpc';
import { useEffect, useState } from 'react';
import { Card, Button } from '@/components/ui';
import { apiAction } from '@/hooks/useApiAction';

function StatusIcon({ status }: { status: string }) {
  if (status === 'READY')
    return <span className="text-2xl">✅</span>;
  if (status === 'DISCONNECTED')
    return <span className="text-2xl">🔴</span>;
  if (status === 'QR_PENDING')
    return <span className="text-2xl">📱</span>;
  return <span className="text-2xl animate-pulse">⏳</span>;
}

function StatusLabel({ status }: { status: string }) {
  const styles: Record<string, string> = {
    READY: 'bg-green-100 text-green-800',
    DISCONNECTED: 'bg-red-100 text-red-800',
    QR_PENDING: 'bg-amber-100 text-amber-800',
    INITIALIZING: 'bg-blue-100 text-blue-800',
    LOADING: 'bg-gray-100 text-gray-500',
  };
  const labels: Record<string, string> = {
    READY: 'Connected',
    DISCONNECTED: 'Disconnected',
    QR_PENDING: 'Waiting for QR Scan',
    INITIALIZING: 'Initializing...',
    LOADING: 'Loading...',
  };
  return (
    <span
      className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${styles[status] || styles.LOADING}`}
    >
      {labels[status] || status}
    </span>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function WhatsAppSettingsPage() {
  const { data: statusData, refetch } = trpc.bot.getStatus.useQuery();
  const pingMutation = trpc.bot.ping.useMutation();
  const logoutMutation = trpc.bot.logout.useMutation();
  const [lastPingResult, setLastPingResult] = useState<string | null>(
    null
  );

  // Poll every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 5000);
    return () => clearInterval(interval);
  }, [refetch]);

  const { status, qr, lastUpdated } = statusData || {
    status: 'LOADING',
    qr: null,
    lastUpdated: null,
  };

  const lastUpdatedDate = lastUpdated ? new Date(lastUpdated) : null;

  const handlePing = async () => {
    setLastPingResult(null);
    const result = await apiAction(
      () => pingMutation.mutateAsync(),
      '🏓 Pong sent to admin!'
    );
    if (result) {
      setLastPingResult(`Sent to ${result.sentTo}`);
    }
  };

  const handleLogout = async () => {
    const confirmed = window.confirm(
      'Logout WhatsApp?\n\nSession akan dihapus dan bot perlu di-pair ulang via QR code.'
    );
    if (!confirmed) return;

    await apiAction(
      () => logoutMutation.mutateAsync(),
      '✅ WhatsApp logged out. Scan QR code untuk reconnect.'
    );
    refetch();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">WhatsApp Integration</h1>
        <p className="text-gray-500">
          Manage your WhatsApp Business connection and test
          connectivity.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Connection Status Card */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              Connection Status
            </h2>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => refetch()}
            >
              ↻ Refresh
            </Button>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <StatusIcon status={status} />
            <div>
              <StatusLabel status={status} />
              {lastUpdatedDate && (
                <p className="text-xs text-gray-400 mt-1">
                  Updated {formatTimeAgo(lastUpdatedDate)}
                </p>
              )}
            </div>
          </div>

          {/* QR Code Section */}
          {status === 'QR_PENDING' && qr && (
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 text-center">
              <p className="text-sm text-gray-600 mb-3">
                Scan this QR code with WhatsApp on your phone
              </p>
              <div className="inline-block bg-white p-3 rounded-lg shadow-sm">
                <img
                  src={qr}
                  alt="WhatsApp QR Code"
                  width={240}
                  height={240}
                  className="rounded"
                />
              </div>
              <p className="text-xs text-gray-400 mt-3">
                QR code refreshes automatically
              </p>
            </div>
          )}

          {status === 'READY' && (
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-green-700 text-sm">
                Bot is connected and ready to send messages.
              </p>
            </div>
          )}

          {status === 'DISCONNECTED' && (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <p className="text-red-700 text-sm">
                Bot is disconnected. It will attempt to reconnect
                automatically.
              </p>
              <p className="text-red-500 text-xs mt-1">
                If this persists, check server logs.
              </p>
            </div>
          )}

          {(status === 'INITIALIZING' || status === 'LOADING') && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-blue-700 text-sm">
                Bot is starting up. This may take a few seconds...
              </p>
            </div>
          )}
        </Card>

        {/* Actions Card */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Actions</h2>

          <div className="space-y-4">
            {/* Ping Test */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-medium text-sm">
                    🏓 Ping Test
                  </h3>
                  <p className="text-xs text-gray-500">
                    Sends "Pong" to admin WhatsApp to verify
                    end-to-end connectivity
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handlePing}
                  isLoading={pingMutation.isPending}
                  loadingText="Sending..."
                  disabled={status !== 'READY'}
                >
                  Send Ping
                </Button>
                {lastPingResult && (
                  <span className="text-xs text-green-600">
                    ✓ {lastPingResult}
                  </span>
                )}
              </div>
              {status !== 'READY' && (
                <p className="text-xs text-amber-600 mt-2">
                  Bot must be connected to send ping
                </p>
              )}
            </div>

            {/* Connection Info */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h3 className="font-medium text-sm mb-2">
                ℹ️ Connection Info
              </h3>
              <div className="space-y-1.5 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Status</span>
                  <span className="font-mono">{status}</span>
                </div>
                {lastUpdatedDate && (
                  <div className="flex justify-between">
                    <span>Last Update</span>
                    <span className="font-mono">
                      {lastUpdatedDate.toLocaleTimeString('id-ID')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Auto Polling</span>
                  <span className="font-mono text-green-600">
                    Every 5s
                  </span>
                </div>
              </div>
            </div>

            {/* Logout */}
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-medium text-sm text-red-700">
                    🚪 Logout WhatsApp
                  </h3>
                  <p className="text-xs text-red-500">
                    Disconnect and clear session. Bot will need
                    to re-pair via QR code.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="danger"
                onClick={handleLogout}
                isLoading={logoutMutation.isPending}
                loadingText="Logging out..."
                disabled={
                  status === 'LOADING' ||
                  status === 'INITIALIZING'
                }
              >
                Logout
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
