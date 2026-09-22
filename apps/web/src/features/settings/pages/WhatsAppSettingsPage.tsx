import { trpc } from '@/lib/trpc';
import { useEffect, useState } from 'react';
import { Card, Button } from '@/components/ui';
import { apiAction } from '@/hooks/useApiAction';

function StatusIcon({ status }: { status: string }) {
  if (status === 'READY') return <span className="text-2xl">✅</span>;
  if (status === 'DISCONNECTED') return <span className="text-2xl">🔴</span>;
  if (status === 'QR_PENDING') return <span className="text-2xl">📱</span>;
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

function formatTimeAgoId(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 5) return 'baru saja';
  if (diff < 60) return `${diff} dtk yang lalu`;
  if (diff < 3600) return `${Math.floor(diff / 60)} mnt yang lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam yang lalu`;
  return `${Math.floor(diff / 86400)} hari yang lalu`;
}

export function WhatsAppSettingsPage() {
  const { data: statusData, refetch } = trpc.bot.getStatus.useQuery();
  const pingMutation = trpc.bot.ping.useMutation();
  const logoutMutation = trpc.bot.logout.useMutation();
  const toggleAiSalesMutation = trpc.bot.toggleAiSales.useMutation();
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

  const status = statusData?.status ?? 'LOADING';
  const qr = statusData?.qr ?? null;
  const lastUpdated = statusData?.lastUpdated ?? null;
  const lastUpdatedDate = lastUpdated ? new Date(lastUpdated) : null;

  const rawLastError = statusData?.lastError ?? null;
  const lastError =
    typeof rawLastError === 'string' && rawLastError.trim().length > 0
      ? rawLastError
      : null;
  const lastErrorAtRaw = statusData?.lastErrorAt ?? null;
  const lastErrorAtCandidate = lastErrorAtRaw
    ? new Date(lastErrorAtRaw)
    : null;
  const lastErrorAtDate =
    lastErrorAtCandidate &&
    !Number.isNaN(lastErrorAtCandidate.getTime())
      ? lastErrorAtCandidate
      : null;
  const isStale = statusData?.stale ?? false;
  const aiSalesEnabled = statusData?.aiSalesEnabled ?? true;

  const handleToggleAiSales = async () => {
    const willDisable = aiSalesEnabled !== false;
    const message = willDisable
      ? 'Hentikan Operasi AI Sales (Emergency Cut)?\n\nBot WhatsApp tidak akan membalas atau memproses pesan otomatis dari pelanggan sampai Anda mengaktifkannya kembali.'
      : 'Pulihkan Operasi AI Sales?\n\nBot WhatsApp akan kembali memproses dan membalas pesan pelanggan secara otomatis.';

    if (!window.confirm(message)) return;

    await apiAction(
      () =>
        toggleAiSalesMutation.mutateAsync({
          enabled: !aiSalesEnabled,
        }),
      willDisable
        ? '🛑 Operasi AI Sales berhasil dihentikan (Emergency Cut aktif)!'
        : '✅ Operasi AI Sales telah berhasil dipulihkan!'
    );
    refetch();
  };

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
          Manage your WhatsApp Business connection, monitor status, and control AI Sales operations.
        </p>
      </div>

      {/* Emergency Cut Warning Banner */}
      {aiSalesEnabled === false && (
        <div
          className="bg-red-50 border-2 border-red-500 rounded-xl p-4 flex items-start gap-3 shadow-sm"
          role="alert"
        >
          <span className="text-2xl">🛑</span>
          <div className="flex-1">
            <h3 className="text-red-800 font-bold text-base">
              Operasi AI Sales Sedang Dihentikan (Emergency Cut Aktif)
            </h3>
            <p className="text-red-700 text-sm mt-0.5">
              Bot WhatsApp tidak akan membalas atau memproses pesan inbound dari pelanggan secara otomatis.
              Semua percakapan baru ditahan demi keamanan operasional sampai saklar darurat diaktifkan kembali.
            </p>
          </div>
        </div>
      )}

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

          {/* Staleness indicator (optional field; hidden on older API shape) */}
          {isStale === true && (
            <div
              className="bg-amber-50 p-4 rounded-lg border border-amber-200 mb-4"
              role="alert"
            >
              <p className="text-amber-800 text-sm font-medium">
                ⚠️ Data{' '}
                {lastUpdatedDate
                  ? `${formatTimeAgoId(lastUpdatedDate)}`
                  : 'kedaluwarsa'}{' '}
                — bot tidak terjangkau, menampilkan status terakhir
                yang diketahui.
              </p>
            </div>
          )}

          {/* Last error (optional fields; hidden when null/undefined) */}
          {lastError && (
            <div
              className="bg-red-50 p-4 rounded-lg border border-red-200 mb-4"
              role="alert"
            >
              <p className="text-red-700 text-sm font-medium">
                ⚠️ Kesalahan terakhir: {lastError}
              </p>
              {lastErrorAtDate && (
                <p className="text-red-500 text-xs mt-1">
                  Terjadi pada{' '}
                  {lastErrorAtDate.toLocaleString('id-ID')} (
                  {formatTimeAgoId(lastErrorAtDate)})
                </p>
              )}
            </div>
          )}

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
          <h2 className="text-lg font-semibold mb-4">Actions & Controls</h2>

          <div className="space-y-4">
            {/* Emergency Cut Operation (Saklar Darurat AI Sales) */}
            <div
              className={`p-4 rounded-lg border transition-colors ${
                aiSalesEnabled
                  ? 'bg-emerald-50/60 border-emerald-200'
                  : 'bg-red-50 border-red-300'
              }`}
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-gray-900">
                      ⚡ Emergency Cut: AI Sales Operation
                    </h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        aiSalesEnabled
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800 font-bold'
                      }`}
                    >
                      {aiSalesEnabled ? 'Aktif' : 'Berhenti Darurat'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Saklar darurat untuk menghentikan respon otomatis AI Sales seketika jika terjadi kendala.
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <Button
                  size="sm"
                  variant={aiSalesEnabled ? 'danger' : 'primary'}
                  onClick={handleToggleAiSales}
                  isLoading={toggleAiSalesMutation.isPending}
                  loadingText="Memproses..."
                >
                  {aiSalesEnabled
                    ? '🛑 Cut Operation (Hentikan AI Sales)'
                    : '✅ Pulihkan Operasi AI Sales'}
                </Button>
              </div>
            </div>

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
                <div className="flex justify-between">
                  <span>AI Sales Operation</span>
                  <span className={`font-mono font-semibold ${aiSalesEnabled ? 'text-green-600' : 'text-red-600'}`}>
                    {aiSalesEnabled ? 'ENABLED' : 'HALTED (CUT)'}
                  </span>
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
