import makeWASocket, {
  DisconnectReason,
  WASocket,
  ConnectionState,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode';
import pino from 'pino';
import { trpc } from '../lib/trpc';
import { useRedisAuthState } from './use-redis-auth-state';

let sock: WASocket | null = null;
let qrDataUrl: string | null = null;
let connectionStatus:
  | 'INITIALIZING'
  | 'QR_PENDING'
  | 'READY'
  | 'DISCONNECTED' = 'INITIALIZING';
let currentClearState: (() => Promise<void>) | null = null;

const logger = pino({ level: 'info' });

export async function initializeBaileys() {
  // Use Redis for session persistence
  const { state, saveCreds, clearState } = await useRedisAuthState();
  currentClearState = clearState;

  sock = makeWASocket({
    auth: state,
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
        // Generate QR code as data URL for frontend
        qrDataUrl = await QRCode.toDataURL(qr);
        connectionStatus = 'QR_PENDING';
        // eslint-disable-next-line no-console
        console.log('[Baileys] QR code generated.');
        updateApiStatus('QR_PENDING', qrDataUrl);
      }

      if (connection === 'close') {
        const statusCode =
          (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect =
          statusCode !== DisconnectReason.loggedOut;
        // eslint-disable-next-line no-console
        console.log(
          '[Baileys] Connection closed. StatusCode:',
          statusCode,
          'Reconnecting:',
          shouldReconnect
        );
        // eslint-disable-next-line no-console
        console.log(
          '[Baileys] Error details:',
          JSON.stringify(lastDisconnect?.error, null, 2)
        );

        // Only clear session on explicit logout (user logged out from phone)
        // Do NOT clear on QR_PENDING — the post-scan handshake can cause
        // a brief disconnect that we need to survive with creds intact
        if (!shouldReconnect) {
          // eslint-disable-next-line no-console
          console.log(
            '[Baileys] Logged out. Clearing Redis state...'
          );
          await clearState();
        }

        connectionStatus = 'DISCONNECTED';
        qrDataUrl = null;
        updateApiStatus('DISCONNECTED', null);

        // Always attempt to reconnect/restart to keep the service alive
        // (unless it's a fatal error, but for now we restart for fresh QR)
        initializeBaileys();
      } else if (connection === 'open') {
        // eslint-disable-next-line no-console
        console.log('[Baileys] Connection opened!');
        connectionStatus = 'READY';
        qrDataUrl = null;
        updateApiStatus('READY', null);
      }
    }
  );

  return sock;
}

async function updateApiStatus(
  status: 'INITIALIZING' | 'QR_PENDING' | 'READY' | 'DISCONNECTED',
  qr: string | null
) {
  try {
    await trpc.bot.updateStatus.mutate({ status, qr });
    // eslint-disable-next-line no-console
    console.log(`[API] Status updated: ${status}`);
  } catch (error) {
    console.error('[API] Failed to update status:', error);
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
