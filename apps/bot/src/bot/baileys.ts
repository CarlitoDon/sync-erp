import makeWASocket, {
  DisconnectReason,
  WASocket,
  ConnectionState,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  jidDecode,
  proto,
} from '@whiskeysockets/baileys';
import { isBoom } from '@hapi/boom';
import QRCode from 'qrcode';
import pino from 'pino';
import { trpc } from '../lib/trpc';
import { useRedisAuthState, resolvePhoneFromLid, getRedisClient } from './use-redis-auth-state';
import { isCustomerAllowed } from '../utils/whitelist';
import { appendChatHistory, getFormattedChatHistory } from '../utils/chat-history';

let sock: WASocket | null = null;
let qrDataUrl: string | null = null;
let connectionStatus:
  | 'INITIALIZING'
  | 'QR_PENDING'
  | 'READY'
  | 'DISCONNECTED' = 'INITIALIZING';
let currentClearState: (() => Promise<void>) | null = null;

const logger = pino({ level: 'info' });

/** Max chars forwarded to the API (`error` input is capped at 500 server-side). */
const MAX_API_ERROR_CHARS = 450;
/** Delay before retrying after init throws (avoids a hot loop when Redis/WA is down). */
const INIT_RETRY_DELAY_MS = 5_000;

/** Internal staff phone numbers to exclude from customer inbound hook */
const INTERNAL_STAFF_PHONES = new Set([
  '6285158858310', // Don
  '6292241851577', // Office
  '628987257284',  // Hesy
  '628562747614',  // Andre
  '6283176406083', // Zay
]);

let cachedAiSalesEnabled = true;

// ---------------------------------------------------------------------------
// Debounce map: per-phone message buffering (3-second window)
// ---------------------------------------------------------------------------

interface DebounceEntry {
  timer: ReturnType<typeof setTimeout>;
  messages: string[];
  customerName: string;
  timestamp: string;
}

const debounceMap = new Map<string, DebounceEntry>();
const DEBOUNCE_DELAY_MS = 3000;

// ---------------------------------------------------------------------------
// Frustration Breaker — detect consecutive clarification messages
// ---------------------------------------------------------------------------

const CLARIFICATION_PATTERN = /maaf.*(?:perjelas|ulangi|jelaskan|paham|mengerti)/i;
const CLARIFICATION_PHRASES = ['bisa diperjelas', 'kurang paham', 'mohon maaf'];
const FRUSTRATION_THRESHOLD = 2;

function isClarificationMessage(text: string): boolean {
  const lower = text.toLowerCase();
  if (CLARIFICATION_PATTERN.test(text)) return true;
  return CLARIFICATION_PHRASES.some((phrase) => lower.includes(phrase));
}

async function getChatHistoryRaw(
  cleanPhone: string,
): Promise<Array<{ role: string; text: string }>> {
  try {
    const redis = getRedisClient();
    const key = `whatsapp:chat_history:${cleanPhone}`;
    const rawList = await redis.lrange(key, -6, -1); // last 6 messages
    const entries: Array<{ role: string; text: string }> = [];
    for (const item of rawList) {
      try {
        const parsed: unknown = JSON.parse(item);
        if (
          parsed &&
          typeof parsed === 'object' &&
          'role' in parsed &&
          'text' in parsed &&
          typeof (parsed as Record<string, unknown>).role === 'string' &&
          typeof (parsed as Record<string, unknown>).text === 'string'
        ) {
          const entry = parsed as { role: string; text: string };
          entries.push({ role: entry.role, text: entry.text });
        }
      } catch {
        // skip
      }
    }
    return entries;
  } catch {
    return [];
  }
}

async function detectFrustration(cleanPhone: string): Promise<{
  detected: boolean;
  count: number;
}> {
  const history = await getChatHistoryRaw(cleanPhone);
  let consecutiveClarifications = 0;
  for (const msg of [...history].reverse()) {
    if (msg.role !== 'assistant') break;
    if (isClarificationMessage(msg.text)) {
      consecutiveClarifications++;
    } else {
      break;
    }
  }
  return {
    detected: consecutiveClarifications >= FRUSTRATION_THRESHOLD,
    count: consecutiveClarifications,
  };
}

// ---------------------------------------------------------------------------
// Core webhook dispatch (called after debounce fires)
// ---------------------------------------------------------------------------

async function dispatchToWebhook(
  cleanPhone: string,
  customerPhone: string,
  customerName: string,
  messageText: string,
  timestamp: string,
): Promise<void> {
  // Mute guard: check Redis session_mode
  try {
    const redis = getRedisClient();
    const mode = await redis.get(`whatsapp:session_mode:${cleanPhone}`);
    if (mode === 'HUMAN') {
      // eslint-disable-next-line no-console
      console.log(`[mute-guard] Skipping webhook for ${customerPhone} — mode HUMAN`);
      return;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      '[mute-guard] Redis error checking session_mode:',
      err instanceof Error ? err.message : String(err),
    );
    // Fail open on Redis error — let the bot respond
  }

  // Read customer note from Redis
  let customerNotes: string | null = null;
  try {
    const redis = getRedisClient();
    customerNotes = await redis.get(`whatsapp:customer_note:${cleanPhone}`);
  } catch {
    // non-fatal
  }

  // Get formatted chat history
  const chatHistory = await getFormattedChatHistory(cleanPhone);

  // Frustration Breaker detection
  let autoEscalation: { reason: string; detail: string } | null = null;
  const frustration = await detectFrustration(cleanPhone);
  if (frustration.detected) {
    autoEscalation = {
      reason: 'FRUSTRATION_BREAKER',
      detail: `Bot gagal memahami customer ${frustration.count}x berturut-turut`,
    };
    // eslint-disable-next-line no-console
    console.log(
      `[frustration-breaker] ${customerPhone} triggered after ${frustration.count} clarification messages`,
    );
  }

  const webhookUrl =
    process.env.CARLA_WEBHOOK_URL ||
    'http://127.0.0.1:8645/webhooks/whatsapp-inbound';

  // eslint-disable-next-line no-console
  console.log(
    `[Baileys] Forwarding debounced message from ${customerPhone} (${customerName}) to Carla webhook: ${webhookUrl}`,
  );

  try {
    const payload: Record<string, unknown> = {
      customerPhone,
      customerName,
      messageText,
      chatHistory,
      timestamp,
    };

    if (customerNotes) {
      payload.customerNotes = customerNotes;
    }

    if (autoEscalation) {
      payload.autoEscalation = autoEscalation;
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(
        `[Baileys] Carla webhook returned HTTP ${res.status} for message from ${customerPhone}`,
      );
    }
  } catch (postErr) {
    console.error(
      '[Baileys] Failed to forward customer message to Carla webhook:',
      postErr instanceof Error ? postErr.message : String(postErr),
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractMessageContent(msg: proto.IMessage | null | undefined): string {
  if (!msg) return '';
  const message =
    msg.ephemeralMessage?.message ||
    msg.viewOnceMessage?.message ||
    msg.viewOnceMessageV2?.message ||
    msg.documentWithCaptionMessage?.message ||
    msg;

  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    ''
  );
}

function toSafeErrorMessage(error: unknown, fallback: string): string {
  let message = fallback;
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object') {
    try {
      message = JSON.stringify(error);
    } catch {
      message = String(error);
    }
  }

  const sanitized = message
    // Sanitize key=value (URL/query parameter format)
    .replace(/((?:key|secret|token|password|auth)[a-z0-9_-]*)=([^\s&]+)/gi, '$1=***')
    // Sanitize "key": "value" (JSON format)
    .replace(/("(?:key|secret|token|password|auth)[a-z0-9_-]*"\s*:\s*)"([^"]+)"/gi, '$1"***"')
    // Sanitize Bearer tokens
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1***')
    .trim();

  return sanitized.slice(0, MAX_API_ERROR_CHARS) || fallback;
}

async function checkAiSalesEnabled(): Promise<boolean> {
  try {
    const res = await trpc.bot.getAiSalesStatus.query();
    if (typeof res?.aiSalesEnabled === 'boolean') {
      cachedAiSalesEnabled = res.aiSalesEnabled;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      '[Baileys] Failed to fetch aiSalesEnabled via tRPC, using cached state:',
      err instanceof Error ? err.message : String(err)
    );
  }
  return cachedAiSalesEnabled;
}

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
          shouldReconnect
        );
        // eslint-disable-next-line no-console
        console.log(
          '[Baileys] Error details:',
          JSON.stringify(lastDisconnect?.error, null, 2)
        );

        if (!shouldReconnect) {
          // eslint-disable-next-line no-console
          console.log(
            '[Baileys] Logged out. Clearing Redis state...'
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
    }
  );

  // Inbound customer message hook
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    // Only process realtime incoming notifications; ignore history sync / append batches
    if (type && type !== 'notify') return;

    try {
      for (const msg of messages) {
        if (msg.key.fromMe) continue;
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid) continue;
        if (remoteJid.endsWith('@g.us')) continue; // Ignore group chats
        if (remoteJid.endsWith('@newsletter')) continue; // Ignore newsletters/channels
        if (remoteJid === 'status@broadcast' || remoteJid.endsWith('@broadcast')) continue;

        // Normalize JID and extract user phone number without device suffix
        const normalizedJid = jidNormalizedUser(remoteJid);
        const decoded = jidDecode(normalizedJid);
        const userPart = decoded?.user ?? remoteJid.split('@')[0].split(':')[0];
        const rawPhone = userPart.replace(/\D/g, '');
        if (!rawPhone) continue;

        let cleanPhone = rawPhone.startsWith('0') ? `62${rawPhone.slice(1)}` : rawPhone;

        // If message is from a WhatsApp LID, resolve the canonical phone number from Redis sync state
        if (remoteJid.endsWith('@lid')) {
          const resolved = await resolvePhoneFromLid(rawPhone);
          if (resolved) {
            cleanPhone = resolved.startsWith('0') ? `62${resolved.slice(1)}` : resolved;
            // eslint-disable-next-line no-console
            console.log(`[Baileys] Resolved LID ${rawPhone} to phone ${cleanPhone}`);
          }
        }

        // Exclude internal staff
        if (INTERNAL_STAFF_PHONES.has(cleanPhone)) {
          continue;
        }

        // Strict customer whitelist check (Redis-backed dynamic whitelist)
        const cleanAllowed = await isCustomerAllowed(cleanPhone);
        const rawAllowed = await isCustomerAllowed(rawPhone);
        if (!cleanAllowed && !rawAllowed) {
          // eslint-disable-next-line no-console
          console.log(
            `[Baileys] Inbound customer message from ${cleanPhone} (raw: ${rawPhone}) ignored: Not in whatsapp:allowed_phones whitelist.`
          );
          continue;
        }

        // Extract message text (handling disappearing / ephemeral messages)
        const messageText = extractMessageContent(msg.message);

        if (!messageText.trim()) continue;

        // Check emergency killswitch / AI sales toggle
        const aiSalesActive = await checkAiSalesEnabled();
        if (!aiSalesActive) {
          // eslint-disable-next-line no-console
          console.log(
            `[Baileys] Inbound customer message from ${cleanPhone} ignored: AI Sales is disabled (Emergency Cut).`
          );
          continue;
        }

        const customerPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;
        const customerName = msg.pushName || 'Customer';
        const timestamp = msg.messageTimestamp
          ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
          : new Date().toISOString();

        // Record incoming message in chat history
        await appendChatHistory(cleanPhone, {
          role: 'customer',
          name: customerName,
          text: messageText,
          timestamp,
        });

        // Debounce: buffer messages per phone, flush after 3s of silence
        const existing = debounceMap.get(cleanPhone);
        if (existing) {
          clearTimeout(existing.timer);
          existing.messages.push(messageText);
          // eslint-disable-next-line no-console
          console.log(
            `[debounce] Buffered message from ${customerPhone}. Total buffered: ${existing.messages.length}`,
          );
          existing.timer = setTimeout(
            () => fireDebounce(cleanPhone, customerPhone, existing),
            DEBOUNCE_DELAY_MS,
          );
        } else {
          const entry: DebounceEntry = {
            timer: null as unknown as NodeJS.Timeout,
            messages: [messageText],
            customerName,
            timestamp,
          };
          entry.timer = setTimeout(
            () => fireDebounce(cleanPhone, customerPhone, entry),
            DEBOUNCE_DELAY_MS,
          );
          debounceMap.set(cleanPhone, entry);
        }
      }
    } catch (error) {
      console.error('[Baileys] Error in messages.upsert handler:', error);
    }
  });

  return sock;
}

async function fireDebounce(
  cleanPhone: string,
  customerPhone: string,
  entry: DebounceEntry,
): Promise<void> {
  debounceMap.delete(cleanPhone);
  const combinedMessage = entry.messages.join('\n');
  // eslint-disable-next-line no-console
  console.log(
    `[debounce] Firing for ${customerPhone} with ${entry.messages.length} message(s)`,
  );
  await dispatchToWebhook(
    cleanPhone,
    customerPhone,
    entry.customerName,
    combinedMessage,
    entry.timestamp,
  );
}

async function updateApiStatus(
  status: 'INITIALIZING' | 'QR_PENDING' | 'READY' | 'DISCONNECTED',
  qr: string | null,
  error?: string | null
) {
  try {
    const res = await trpc.bot.updateStatus.mutate({
      status,
      qr,
      error: error ?? null,
    });
    if (typeof res?.aiSalesEnabled === 'boolean') {
      cachedAiSalesEnabled = res.aiSalesEnabled;
    }
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
