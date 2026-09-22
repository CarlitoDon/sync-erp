import makeWASocket, {
  DisconnectReason,
  type WASocket,
  type ConnectionState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { isBoom } from '@hapi/boom';
import QRCode from 'qrcode';
import pino from 'pino';
import { trpc } from '../lib/trpc';
import { useRedisAuthState } from './use-redis-auth-state';
import { toSafeErrorMessage } from './error-sanitizer';
import { routeIncomingMessages } from './message-router';

export {
  recordBotSentMessageId,
  isBotSentMessage,
  clearBotSentMessageIds,
} from './bot-message-tracker';

export {
  INTERNAL_STAFF_PHONES,
  INTERNAL_STAFF_LIDS,
  isInternalStaff,
} from '../constants/staff';

let sock: WASocket | null = null;
let qrDataUrl: string | null = null;
let connectionStatus:
  | 'INITIALIZING'
  | 'QR_PENDING'
  | 'READY'
  | 'DISCONNECTED' = 'INITIALIZING';
let currentClearState: (() => Promise<void>) | null = null;

const logger = pino({ level: 'info' });
const INIT_RETRY_DELAY_MS = 5_000;

export async function initializeBaileys() {
  try {
    await startBaileysSocket();
  } catch (error) {
    connectionStatus = 'DISCONNECTED';
    qrDataUrl = null;
    const message = toSafeErrorMessage(error, 'Initialization failed');
    // eslint-disable-next-line no-console
    console.error('[Baileys] Initialization failed:', message);
    await updateApiStatus('DISCONNECTED', null, message);
    setTimeout(() => {
      initializeBaileys();
    }, INIT_RETRY_DELAY_MS);
  }
}

async function startBaileysSocket() {
  // Use Redis for session persistence
  const { state, saveCreds, clearState } = await useRedisAuthState();
  currentClearState = clearState;

  // Fetch latest WhatsApp version to avoid 405 errors
  const { version } = await fetchLatestBaileysVersion();
  // eslint-disable-next-line no-console
  console.log('[Baileys] Using WA version:', version);

  sock = makeWASocket({
    auth: state,
    version,
    logger,
    printQRInTerminal: false,
    connectTimeoutMs: 60_000,
    defaultQueryTimeoutMs: 60_000,
    keepAliveIntervalMs: 10_000,
    emitOwnEvents: true,
    retryRequestDelayMs: 250,
    browser: ['Sync ERP', 'Chrome', '10.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on(
    'connection.update',
    async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrDataUrl = await QRCode.toDataURL(qr);
        connectionStatus = 'QR_PENDING';
        // eslint-disable-next-line no-console
        console.log('[Baileys] QR code generated.');
        await updateApiStatus('QR_PENDING', qrDataUrl, null);
      }

      if (connection === 'close') {
        const disconnectError = lastDisconnect?.error;
        const statusCode = isBoom(disconnectError)
          ? disconnectError.output.statusCode
          : undefined;
        const shouldReconnect =
          statusCode !== DisconnectReason.loggedOut;

        const reasonText = statusCode
          ? `DisconnectReason: ${statusCode}`
          : 'Connection closed';
        const errorMessage = disconnectError
          ? toSafeErrorMessage(disconnectError, reasonText)
          : reasonText;

        // eslint-disable-next-line no-console
        console.log(
          '[Baileys] Connection closed. StatusCode:',
          statusCode,
          'Reconnecting:',
          shouldReconnect,
        );
        // eslint-disable-next-line no-console
        console.log(
          '[Baileys] Error details:',
          JSON.stringify(lastDisconnect?.error, null, 2),
        );

        if (!shouldReconnect) {
          // eslint-disable-next-line no-console
          console.log(
            '[Baileys] Logged out. Clearing Redis state...',
          );
          await clearState();
        }

        connectionStatus = 'DISCONNECTED';
        qrDataUrl = null;
        await updateApiStatus('DISCONNECTED', null, errorMessage);

        setTimeout(() => {
          initializeBaileys();
        }, INIT_RETRY_DELAY_MS);
      } else if (connection === 'open') {
        // eslint-disable-next-line no-console
        console.log('[Baileys] Connection opened!');
        connectionStatus = 'READY';
        qrDataUrl = null;
        await updateApiStatus('READY', null, null);
      }
    },
  );

  // Inbound customer message hook
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    // Only process realtime incoming notifications; ignore history sync / append batches
    if (type && type !== 'notify') return;

    try {
      if (sock) {
        await routeIncomingMessages(messages, sock);
      }
    } catch (error) {
      console.error('[Baileys] Error in messages.upsert handler:', error);
    }
  });

  return sock;
}

export async function updateApiStatus(
  status: 'INITIALIZING' | 'QR_PENDING' | 'READY' | 'DISCONNECTED',
  qr: string | null,
  error?: string | null,
) {
  try {
    await trpc.bot.updateStatus.mutate({
      status,
      qr,
    });
    // eslint-disable-next-line no-console
    console.log(`[API] Status updated: ${status}${error ? ` (error: ${error})` : ''}`);
  } catch (err) {
    console.error('[API] Failed to update status:', err);
  }
}

export function getSocket(): WASocket | null {
  return sock;
}

export function getStatus() {
  return connectionStatus;
}

export function getQrDataUrl() {
  return qrDataUrl;
}

/**
 * Logout from WhatsApp, clear session, and restart for fresh QR.
 */
export async function logoutAndRestart() {
  // eslint-disable-next-line no-console
  console.log('[Baileys] Manual logout requested...');

  // Close existing socket
  if (sock) {
    try {
      await sock.logout();
      // eslint-disable-next-line no-console
      console.log('[Baileys] Socket logged out.');
    } catch {
      // If logout fails (already disconnected), just end the socket
      try {
        sock.end(undefined);
      } catch {
        // ignore
      }
    }
    sock = null;
  }

  // Clear all session data from Redis
  if (currentClearState) {
    await currentClearState();
    // eslint-disable-next-line no-console
    console.log('[Baileys] Session cleared from Redis.');
  }

  // Reset state
  connectionStatus = 'INITIALIZING';
  qrDataUrl = null;

  // Re-initialize for fresh QR
  initializeBaileys();
}
