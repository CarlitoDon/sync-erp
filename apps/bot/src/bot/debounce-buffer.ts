/**
 * Debounce Buffer & In-Flight Guard
 * Buffers rapid successive customer messages within a debounce window (default: 7s),
 * and queues incoming messages if a previous webhook dispatch is still in-flight.
 */

import type { WASocket } from '@whiskeysockets/baileys';
import { dispatchToWebhook } from './webhook-dispatcher';

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
}

const debounceMap = new Map<string, DebounceEntry>();
const inFlightMap = new Map<string, InFlightEntry>();
const DEBOUNCE_DELAY_MS = Number(process.env.WHATSAPP_DEBOUNCE_MS) || 7000;

export async function fireDebounce(
  cleanPhone: string,
  customerPhone: string,
  entry: DebounceEntry,
  sock: WASocket | null,
): Promise<void> {
  debounceMap.delete(cleanPhone);
  const combinedMessage = entry.messages.join('\n');

  // In-flight guard: if a webhook is already processing for this phone,
  // queue the messages for dispatch after the current one finishes.
  const existing = inFlightMap.get(cleanPhone);
  if (existing?.pending) {
    existing.queuedMessages.push(combinedMessage);
    existing.timestamp = entry.timestamp;
    // eslint-disable-next-line no-console
    console.log(
      `[in-flight] Queued ${entry.messages.length} message(s) for ${customerPhone} (webhook still processing)`,
    );
    return;
  }

  // Mark as in-flight
  const flight: InFlightEntry = {
    pending: true,
    queuedMessages: [],
    customerName: entry.customerName,
    customerPhone,
    timestamp: entry.timestamp,
  };
  inFlightMap.set(cleanPhone, flight);

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
  } finally {
    // Check if new messages arrived while webhook was running
    const queued = flight.queuedMessages;
    inFlightMap.delete(cleanPhone);

    if (queued.length > 0) {
      const nextBatch = queued.join('\n');
      // eslint-disable-next-line no-console
      console.log(
        `[in-flight] Dispatching queued messages for ${customerPhone} (${queued.length} batch(es))...`,
      );
      // Dispatch queued batch with in-flight protection
      const nextEntry: DebounceEntry = {
        timer: null,
        messages: [nextBatch],
        customerName: flight.customerName,
        timestamp: flight.timestamp,
      };
      await fireDebounce(cleanPhone, customerPhone, nextEntry, sock);
    }
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
      DEBOUNCE_DELAY_MS,
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
      DEBOUNCE_DELAY_MS,
    );
    debounceMap.set(cleanPhone, entry);
  }
}
