import type { Request, Response } from 'express';
import { z } from 'zod';
import { getSocket, getStatus, recordBotSentMessageId } from '../bot/baileys';
import {
  formatPhoneNumber,
  isValidIndonesianNumber,
} from '../utils/phone';
import { isCustomerAllowed } from '../utils/whitelist';
import { appendChatHistory } from '../utils/chat-history';
import { releaseTurn } from '../bot/debounce-buffer';

const SendMessageSchema = z.object({
  phone: z.string(),
  message: z.string(),
});

/**
 * Send options for a plain WhatsApp text message.
 *
 * Egress hardening: linkPreview is pinned to null on the generic send-message
 * path so an operator-supplied message containing URLs never triggers Baileys
 * to fetch a remote preview (the same guarantee send-order already provides).
 * Baileys only fetches a preview when the option is present, so omitting it
 * is not sufficient — it must be explicitly disabled.
 */
const PLAIN_TEXT_OPTIONS = { linkPreview: null } as const;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Splits a message into individual WhatsApp chat bubbles.
 * Bubbles are separated by a delimiter consisting of 3 or more hyphens on their own line:
 * e.g. "\n---\n" or "\n-----\n"
 */
export function splitMessageBubbles(message: string): string[] {
  const parts = message
    .split(/(?:^|\r?\n|\\r?n)[ \t]*-{3,}[ \t]*(?:\r?\n|\\r?n|$)/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !/^[- \t]+$/.test(part));

  if (parts.length > 0) {
    return parts;
  }

  const trimmed = message.trim();
  if (
    trimmed.length === 0 ||
    /^[- \t\r\n]+$/.test(trimmed) ||
    /^(?:[- \t\r\n]|\\r?n)+$/.test(trimmed)
  ) {
    return [];
  }

  return [trimmed];
}

async function safelySetPresence(
  sock: NonNullable<ReturnType<typeof getSocket>>,
  presence: 'composing' | 'available' | 'paused',
  targetNumber: string
): Promise<void> {
  try {
    if (typeof sock.sendPresenceUpdate === 'function') {
      await sock.sendPresenceUpdate(presence, targetNumber);
    }
  } catch (err: unknown) {
    // eslint-disable-next-line no-console
    console.warn(
      `[Presence] Failed to set presence "${presence}" for ${targetNumber}:`,
      err instanceof Error ? err.message : String(err)
    );
  }
}

export const sendMessage = async (req: Request, res: Response) => {
  // 1. Validate Payload
  const result = SendMessageSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: 'Validation Error',
      details: result.error.issues,
    });
  }

  const { phone, message } = result.data;

  // 2. Validate Phone Number
  if (!isValidIndonesianNumber(phone)) {
    return res.status(400).json({
      error: 'Invalid Phone Number',
      message:
        'Nomor WhatsApp tidak valid (Gunakan format 08... atau 62...)',
    });
  }

  // 2b. Validate recipient permission (single source of truth: Redis whitelist & staff protection)
  const allowed = await isCustomerAllowed(phone);
  if (!allowed) {
    return res.status(403).json({
      error: 'Forbidden',
      message:
        'Nomor penerima tidak diizinkan oleh whitelist atau diblokir proteksi staf.',
    });
  }

  // 3. Check Bot Status
  if (getStatus() !== 'READY') {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Bot WhatsApp belum siap. Hubungi admin.',
    });
  }

  const sock = getSocket();
  if (!sock) {
    return res
      .status(500)
      .json({ error: 'Internal Error: Socket instance missing' });
  }

  // 4. Send Message with multi-bubble support and typing simulation
  // Baileys expects format: 628xxx@s.whatsapp.net
  const targetNumber = formatPhoneNumber(phone);

  // Leak protection: sanitize internal ERP / tooling names from leaking to WhatsApp customers
  const sanitizedMessage = message
    .replace(/\bsync[-\s]?erp(\s+santi\s+living)?\b/gi, 'Santi Living')
    .replace(/\berp\b/gi, 'Santi Living');

  const bubbles = splitMessageBubbles(sanitizedMessage);
  if (bubbles.length === 0) {
    return res.status(400).json({
      error: 'Invalid Message',
      message: 'Pesan tidak boleh kosong',
    });
  }

  let lastMessageId = 'unknown';
  const sentMessageIds: string[] = [];

  try {
    for (let i = 0; i < bubbles.length; i++) {
      const bubble = bubbles[i];

      // Typing indicator: show "composing" presence
      await safelySetPresence(sock, 'composing', targetNumber);

      // Typing simulation delay:
      // First bubble: 800-1500ms
      // Subsequent bubbles: 1200-2000ms
      const typingDelay =
        i === 0
          ? randomBetween(800, 1500)
          : randomBetween(1200, 2000);

      await delay(typingDelay);

      const response = await sock.sendMessage(targetNumber, {
        text: bubble,
        ...PLAIN_TEXT_OPTIONS,
      });

      const messageId = response?.key?.id ?? 'unknown';
      lastMessageId = messageId;
      sentMessageIds.push(messageId);
      recordBotSentMessageId(messageId);

      // Record each bubble into conversation history for LLM continuity
      await appendChatHistory(phone, {
        role: 'assistant',
        name: 'Rara',
        text: bubble,
        timestamp: new Date().toISOString(),
      });
    }

    await safelySetPresence(sock, 'available', targetNumber);

    // Release turn lock and flush any customer messages queued during this turn
    const cleanPhone = phone.replace(/\D/g, '').replace(/^0/, '62');
    await releaseTurn(cleanPhone, sock);

    // eslint-disable-next-line no-console
    console.log(`Sent ${bubbles.length} bubble(s) to ${targetNumber}`);

    return res.status(200).json({
      success: true,
      messageId: lastMessageId,
      messageIds: sentMessageIds,
      bubbleCount: bubbles.length,
    });
  } catch (error: unknown) {
    // Ensure we clear composing state on error
    await safelySetPresence(sock, 'available', targetNumber);

    const cleanPhone = phone.replace(/\D/g, '').replace(/^0/, '62');
    await releaseTurn(cleanPhone, sock);

    console.error('Failed to send message:', error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Gagal mengirim pesan WhatsApp';

    return res.status(500).json({
      error: 'Delivery Failed',
      message: errorMessage,
      sentMessageIds,
    });
  }
};
