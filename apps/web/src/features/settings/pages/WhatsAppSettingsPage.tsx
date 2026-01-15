import { trpc } from '@/lib/trpc';
import { useEffect } from 'react';
import { Card, Button } from '@/components/ui';

export function WhatsAppSettingsPage() {
  const { data: statusData, refetch } = trpc.bot.getStatus.useQuery();

  // Poll every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 5000);
    return () => clearInterval(interval);
  }, [refetch]);

  const { status, qr } = statusData || {
    status: 'LOADING',
    qr: null,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">WhatsApp Integrations</h1>
        <p className="text-gray-500">
          Manage your WhatsApp Business connection.
        </p>
      </div>

      <Card className="p-6 max-w-md">
        <h2 className="text-lg font-semibold mb-4">
          Connection Status
        </h2>

        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="text-center">
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                status === 'READY'
                  ? 'bg-green-100 text-green-800'
                  : status === 'DISCONNECTED'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {status}
            </span>
          </div>

          {status === 'QR_PENDING' && qr && (
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              {/* Baileys sends a data URL, so we display it as img */}
              <img
                src={qr}
                alt="WhatsApp QR Code"
                width={256}
                height={256}
              />
              <p className="text-xs text-center mt-2 text-gray-400">
                Scan with WhatsApp
              </p>
            </div>
          )}

          {status === 'READY' && (
            <div className="text-green-600">
              <p>✅ Bot is connected and ready.</p>
            </div>
          )}

          {status === 'DISCONNECTED' && (
            <div className="text-red-500 text-center">
              <p>Bot is disconnected.</p>
              <p className="text-sm">
                Please check the server logs or try restarting the
                bot.
              </p>
            </div>
          )}

          <div className="pt-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
            >
              Refresh Status
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
