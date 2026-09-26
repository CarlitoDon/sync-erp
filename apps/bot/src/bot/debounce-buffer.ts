/**
 * Debounce Buffer & Turn Locking Guard
 *
 * Buffers rapid successive customer messages within a debounce window (default: 7s),
 * and locks the turn while Hermes LLM is processing until the bot sends an outbound
 * response (/send-message or /send-image) or a 45s safety timeout expires.
 */

import type { WASocket } from '@whiskeysockets/baileys';
import { dispatchToWebhook } from './webhook-dispatcher';
import { getBotConfig } from '../config/bot.config';
import { getRedisClient } from './use-redis-auth-state';

export interface DebounceEntry {
  timer: ReturnType<typeof setTimeout> | null;
  messages: string[];
  customerName: string;
  timestamp: string;
  mediaUrl?: string | null;
}

export interface InFlightEntry {
  pending: boolean;
  queuedMessages: string[];
  customerName: string;
  customerPhone: string;
  timestamp: string;
  timeoutTimer: ReturnType<typeof setTimeout> | null;
}

const debounceMap = new Map<string, DebounceEntry>();
const inFlightMap = new Map<string, InFlightEntry>();

/**
 * Releases the active turn lock for a customer and flushes any queued messages
 * that arrived while Hermes was generating its response.
 */
export async function releaseTurn(
  cleanPhone: string,
  sock: WASocket | null,
): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.del(`whatsapp:active_turn:${cleanPhone}`);
  } catch {
    // non-fatal
  }

  const flight = inFlightMap.get(cleanPhone);
  if (!flight) return;

  if (flight.timeoutTimer) {
    clearTimeout(flight.timeoutTimer);
  }

  const queued = flight.queuedMessages;
  inFlightMap.delete(cleanPhone);

  if (queued.length > 0) {
    const nextBatch = queued.join('\n');
    // eslint-disable-next-line no-console
    console.log(
      `[in-flight] Active turn released for ${flight.customerPhone}. Dispatching ${queued.length} queued message(s)...`,
    );
    const nextEntry: DebounceEntry = {
      timer: null,
      messages: [nextBatch],
      customerName: flight.customerName,
      timestamp: flight.timestamp,
    };
    await fireDebounce(cleanPhone, flight.customerPhone, nextEntry, sock);
  }
}

export async function fireDebounce(
  cleanPhone: string,
  customerPhone: string,
  entry: DebounceEntry,
  sock: WASocket | null,
): Promise<void> {
  debounceMap.delete(cleanPhone);
  const combinedMessage = entry.messages.join('\n');

  // In-flight guard: if a turn is already processing for this customer,
  // queue the messages for dispatch after the current turn completes.
  const existing = inFlightMap.get(cleanPhone);
  if (existing?.pending) {
    existing.queuedMessages.push(combinedMessage);
    existing.timestamp = entry.timestamp;
    // eslint-disable-next-line no-console
    console.log(
      `[in-flight] Queued ${entry.messages.length} message(s) for ${customerPhone} (Hermes turn still active)`,
    );
    return;
  }

  // Safety timeout: 45 seconds max per turn to prevent permanent lock if LLM hangs
  const timeoutTimer = setTimeout(() => {
    // eslint-disable-next-line no-console
    console.warn(
      `[in-flight] Turn timeout for ${customerPhone} (45s reached). Auto-releasing lock...`,
    );
    releaseTurn(cleanPhone, sock).catch((err: unknown) => {
      console.error('[in-flight] Error auto-releasing turn:', err);
    });
  }, 45_000);

  // Mark as in-flight
  const flight: InFlightEntry = {
    pending: true,
    queuedMessages: [],
    customerName: entry.customerName,
    customerPhone,
    timestamp: entry.timestamp,
    timeoutTimer,
  };
  inFlightMap.set(cleanPhone, flight);

  try {
    const redis = getRedisClient();
    await redis.set(`whatsapp:active_turn:${cleanPhone}`, '1', 'EX', 45);
  } catch {
    // non-fatal
  }

  // eslint-disable-next-line no-console
  console.log(
    `[debounce] Fired for ${customerPhone} (${entry.messages.length} message(s) batched). Dispatching to webhook...`,
  );

  try {
    await dispatchToWebhook(
      cleanPhone,
      customerPhone,
      entry.customerName,
      combinedMessage,
      entry.timestamp,
      sock,
      entry.mediaUrl,
    );
  } catch (err: unknown) {
    console.error(`[debounce] Failed to dispatch webhook for ${customerPhone}:`, err);
    // On immediate dispatch failure, release turn lock so customer is not stuck
    await releaseTurn(cleanPhone, sock);
  }
}

export function bufferIncomingMessage(
  cleanPhone: string,
  customerPhone: string,
  customerName: string,
  messageText: string,
  timestamp: string,
  sock: WASocket | null,
  mediaUrl?: string | null,
): void {
  const existing = debounceMap.get(cleanPhone);
  const delayMs = getBotConfig().debounceMs;

  if (existing) {
    if (existing.timer) clearTimeout(existing.timer);
    existing.messages.push(messageText);
    if (mediaUrl) existing.mediaUrl = mediaUrl;
    // eslint-disable-next-line no-console
    console.log(
      `[debounce] Buffered message from ${customerPhone}. Total buffered: ${existing.messages.length}`,
    );
    existing.timer = setTimeout(
      () => fireDebounce(cleanPhone, customerPhone, existing, sock),
      delayMs,
    );
  } else {
    const entry: DebounceEntry = {
      timer: null,
      messages: [messageText],
      customerName,
      timestamp,
      mediaUrl,
    };
    entry.timer = setTimeout(
      () => fireDebounce(cleanPhone, customerPhone, entry, sock),
      delayMs,
    );
    debounceMap.set(cleanPhone, entry);
  }
}
