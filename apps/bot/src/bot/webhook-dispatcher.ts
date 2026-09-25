/**
 * Webhook Dispatcher
 * Dispatches customer messages and inbound media payloads to the Hermes agent webhook.
 */

import type { WASocket } from '@whiskeysockets/baileys';
import { isSessionMuted } from './owner-takeover';
import { detectFrustration } from './frustration-detector';
import { toSafeErrorMessage } from './error-sanitizer';
import { getBotConfig } from '../config/bot.config';
import { getRedisClient } from './use-redis-auth-state';
import { getFormattedChatHistory } from '../utils/chat-history';

export async function dispatchToWebhook(
  cleanPhone: string,
  customerPhone: string,
  customerName: string,
  messageText: string,
  timestamp: string,
  sock: WASocket | null,
  mediaUrl?: string | null,
): Promise<void> {
  const isMuted = await isSessionMuted(cleanPhone);
  if (isMuted) {
    // eslint-disable-next-line no-console
    console.log(`[mute-guard] Skipping webhook for ${customerPhone} — mode HUMAN`);
    return;
  }

  // Frustration breaker
  const frustration = await detectFrustration(cleanPhone);
  if (frustration.detected) {
    // eslint-disable-next-line no-console
    console.warn(
      `[frustration-breaker] Escalation triggered for ${cleanPhone} (${frustration.count} consecutive clarification messages)`,
    );
  }

  // Customer Notes from Redis
  let customerNotes: string | null = null;
  try {
    const redis = getRedisClient();
    customerNotes = await redis.get(`whatsapp:customer_note:${cleanPhone}`);
  } catch {
    // non-fatal
  }

  // Rolling Chat History
  const chatHistory = await getFormattedChatHistory(cleanPhone);

  const autoEscalation = frustration.detected
    ? JSON.stringify({
        reason: 'FRUSTRATION_BREAKER',
        detail: `Bot gagal memahami customer ${frustration.count}x berturut-turut`,
      })
    : 'None';

  const webhookUrl = getBotConfig().webhookUrl;

  const payload = {
    // Hermes camelCase schema (matches prompt template in ~/.hermes/profiles/rara/config.yaml)
    customerPhone,
    customerName: customerName || 'Pelanggan',
    messageText,
    chatHistory: chatHistory || '(Belum ada riwayat sebelumnya)',
    timestamp,
    customerNotes: customerNotes || 'Tidak ada catatan khusus',
    autoEscalation,
    mediaUrl: mediaUrl || undefined,

    // Backward-compatibility aliases
    phone: customerPhone,
    text: messageText,
    customer_name: customerName || 'Pelanggan',
    media_url: mediaUrl || undefined,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(
        `[webhook-dispatcher] Webhook returned status ${response.status} for ${customerPhone}`,
      );
    }
  } catch (postErr) {
    const safeErr = toSafeErrorMessage(postErr, 'Webhook post failed');
    console.error(
      `[webhook-dispatcher] Failed to forward customer message to Rara webhook (${safeErr})`,
    );

    if (sock) {
      try {
        const jid = `${cleanPhone}@s.whatsapp.net`;
        await sock.sendMessage(jid, {
          text: 'Halo kak, pesan kakak sudah kami terima. Mohon ditunggu sebentar yaa, admin/sistem kami sedang menyiapkan rincian informasinya 😊\n\n-r',
        });
      } catch (replyErr) {
        console.error('[webhook-dispatcher] Failed to send fallback message:', replyErr);
      }
    }
  }
}
