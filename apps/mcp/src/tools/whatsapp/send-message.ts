import path from 'node:path';
import fs from 'node:fs';
import { z } from 'zod';
import { getString } from '../_helpers.js';
import { getWhatsAppConfig } from '../../config.js';
import {
  normalizePhone,
  formatRaraMessageWithSignature,
  splitBubbles,
} from '@sync-erp/shared/whatsapp';

export const WhatsAppSendResponseSchema = z.object({
  success: z.boolean(),
  messageId: z.string().optional(),
  messageIds: z.array(z.string()).optional(),
  bubbleCount: z.number().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

const BridgeSendResponseSchema = z.object({
  success: z.boolean().optional(),
  messageId: z.string().optional(),
  messageIds: z.array(z.string()).optional(),
  error: z.string().optional(),
});

const HERMES_BRIDGE_URL = process.env.HERMES_BRIDGE_URL ?? 'http://127.0.0.1:3100';

function resolveAssetPath(imagePath: string): string {
  const candidates = [
    path.isAbsolute(imagePath) ? imagePath : path.resolve(process.cwd(), imagePath),
    path.resolve(process.cwd(), 'apps/bot', imagePath),
    path.resolve('/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/apps/bot', imagePath),
    path.resolve('/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/apps/bot/assets', path.basename(imagePath)),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  return found ?? candidates[0];
}

async function trySendViaHermesBridge(
  endpoint: string,
  body: Record<string, unknown>
): Promise<{ success: boolean; messageId?: string; messageIds?: string[] } | null> {
  if (process.env.NODE_ENV === 'test') {
    return null;
  }
  try {
    const res = await fetch(`${HERMES_BRIDGE_URL}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return null;
    }
    const raw: unknown = await res.json();
    const parsed = BridgeSendResponseSchema.safeParse(raw);
    if (parsed.success && parsed.data.success !== false) {
      return {
        success: true,
        messageId: parsed.data.messageId ?? parsed.data.messageIds?.[0],
        messageIds: parsed.data.messageIds,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function handleWhatsappSendMessage(args: Record<string, unknown>): Promise<string> {
  const phone = getString(args, 'phone');
  const rawMessage = getString(args, 'message');
  // Sanitize internal system terminology: never leak "Sync ERP" / "ERP" to customer WhatsApp
  const cleanRaw = rawMessage
    .replace(/\bsync[-\s]?erp(\s+santi\s+living)?\b/gi, 'Santi Living')
    .replace(/\berp\b/gi, 'Santi Living');
  const message = formatRaraMessageWithSignature(cleanRaw);
  const normalized = normalizePhone(phone);
  const chatId = `${normalized}@s.whatsapp.net`;

  // 1. Try direct Hermes native bridge first (supporting multi-bubble delivery)
  const bubbles = splitBubbles(message);
  const targetBubbles = bubbles.length > 0 ? bubbles : [message];
  const bridgeSentIds: string[] = [];
  let bridgeFailed = false;

  for (let i = 0; i < targetBubbles.length; i++) {
    const bubble = targetBubbles[i];
    const bridgeResult = await trySendViaHermesBridge('send', { chatId, message: bubble });
    if (bridgeResult && bridgeResult.success) {
      if (bridgeResult.messageId) bridgeSentIds.push(bridgeResult.messageId);
      if (i < targetBubbles.length - 1) {
        await new Promise((r) => setTimeout(r, 600));
      }
    } else {
      bridgeFailed = true;
      break;
    }
  }

  if (!bridgeFailed && bridgeSentIds.length > 0) {
    return JSON.stringify({
      success: true,
      messageId: bridgeSentIds[0],
      messageIds: bridgeSentIds,
      bubbleCount: bridgeSentIds.length,
    });
  }

  // 2. Fallback to apps/bot REST endpoint
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
  const chatId = `${phone}@s.whatsapp.net`;
  const resolvedPath = resolveAssetPath('assets/qris.jpg');

  // 1. Try direct Hermes native bridge first
  const bridgeResult = await trySendViaHermesBridge('send-media', {
    chatId,
    filePath: resolvedPath,
    mediaType: 'image',
    caption: '',
  });
  if (bridgeResult && bridgeResult.success) {
    return JSON.stringify({
      success: true,
      messageId: bridgeResult.messageId,
    });
  }

  // 2. Fallback to apps/bot
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

export async function handleWhatsappSendSnk(args: Record<string, unknown>): Promise<string> {
  const customerPhone = getString(args, 'customerPhone');
  const phone = normalizePhone(customerPhone);
  const chatId = `${phone}@s.whatsapp.net`;
  const resolvedPath = resolveAssetPath('assets/snk.png');

  // 1. Try direct Hermes native bridge first
  const bridgeResult = await trySendViaHermesBridge('send-media', {
    chatId,
    filePath: resolvedPath,
    mediaType: 'image',
    caption: '',
  });
  if (bridgeResult && bridgeResult.success) {
    return JSON.stringify({
      success: true,
      messageId: bridgeResult.messageId,
    });
  }

  // 2. Fallback to apps/bot
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
    body: JSON.stringify({ phone, imagePath: 'assets/snk.png', caption: '' }),
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
    throw new Error(`WhatsApp send SnK image failed: ${errMsg}`);
  }

  return JSON.stringify({
    success: true,
    messageId: data.messageId,
  });
}

