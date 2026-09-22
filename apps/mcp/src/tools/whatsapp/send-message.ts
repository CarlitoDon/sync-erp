import { z } from 'zod';
import { getString } from '../_helpers.js';
import { getWhatsAppConfig } from '../../config.js';
import { isInternalStaff } from '../../constants/staff.js';
import { normalizePhone, formatRaraMessageWithSignature } from '@sync-erp/shared/whatsapp';

export const WhatsAppSendResponseSchema = z.object({
  success: z.boolean(),
  messageId: z.string().optional(),
  messageIds: z.array(z.string()).optional(),
  bubbleCount: z.number().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

export async function handleWhatsappSendMessage(args: Record<string, unknown>): Promise<string> {
  const phone = getString(args, 'phone');
  const rawMessage = getString(args, 'message');
  const message = formatRaraMessageWithSignature(rawMessage);

  if (isInternalStaff(phone)) {
    throw new Error(
      `Cannot send automated customer sales message to internal staff/store: ${phone}`
    );
  }

  const config = getWhatsAppConfig();
  const botUrl = config.botUrl;
  const secret = config.botSecret;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (secret) {
    // apps/bot authenticateApiKey middleware expects Bearer token matching SYNC_ERP_BOT_SECRET
    headers.Authorization = `Bearer ${secret}`;
    headers['X-Bot-Secret'] = secret;
  }

  const response = await fetch(`${botUrl}/send-message`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ phone, message }),
    signal: AbortSignal.timeout(30000),
  });

  const rawJson: unknown = await response.json();
  const parsed = WhatsAppSendResponseSchema.safeParse(rawJson);

  if (!parsed.success) {
    throw new Error(`Unexpected response from WhatsApp bot: ${JSON.stringify(rawJson)}`);
  }

  const data = parsed.data;

  if (!response.ok || !data.success) {
    const errMsg = data.message ?? data.error ?? `HTTP ${response.status}`;
    throw new Error(`WhatsApp send failed: ${errMsg}`);
  }

  return JSON.stringify({
    success: true,
    messageId: data.messageId,
    messageIds: data.messageIds,
    bubbleCount: data.bubbleCount ?? 1,
  });
}

export async function handleWhatsappSendQris(args: Record<string, unknown>): Promise<string> {
  const customerPhone = getString(args, 'customerPhone');
  const phone = normalizePhone(customerPhone);

  const config = getWhatsAppConfig();
  const botUrl = config.botUrl;
  const secret = config.botSecret;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
    headers['X-Bot-Secret'] = secret;
  }

  const response = await fetch(`${botUrl}/send-image`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ phone, imagePath: 'assets/qris.jpg', caption: '' }),
    signal: AbortSignal.timeout(30000),
  });

  const rawJson: unknown = await response.json();
  const parsed = WhatsAppSendResponseSchema.safeParse(rawJson);

  if (!parsed.success) {
    throw new Error(`Unexpected response from WhatsApp bot: ${JSON.stringify(rawJson)}`);
  }

  const data = parsed.data;

  if (!response.ok || !data.success) {
    const errMsg = data.message ?? data.error ?? `HTTP ${response.status}`;
    throw new Error(`WhatsApp send image failed: ${errMsg}`);
  }

  return JSON.stringify({
    success: true,
    messageId: data.messageId,
  });
}
