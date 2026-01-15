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

const logger = pino({ level: 'info' });

export async function initializeBaileys() {
  // Use Redis for session persistence
  const { state, saveCreds } = await useRedisAuthState();

  sock = makeWASocket({
    auth: state,
    logger,
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
        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !==
          DisconnectReason.loggedOut;
        // eslint-disable-next-line no-console
        console.log(
          '[Baileys] Connection closed. Reconnecting:',
          shouldReconnect
        );
        // eslint-disable-next-line no-console
        console.log(
          '[Baileys] Error details:',
          JSON.stringify(lastDisconnect?.error, null, 2)
        );
        connectionStatus = 'DISCONNECTED';
        qrDataUrl = null;
        updateApiStatus('DISCONNECTED', null);

        if (shouldReconnect) {
          initializeBaileys();
        }
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
