import type { Request, Response } from 'express';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { getSocket, getStatus, recordBotSentMessageId } from '../bot/baileys';
import { formatPhoneNumber, isValidIndonesianNumber } from '../utils/phone';
import { isCustomerAllowed } from '../utils/whitelist';

const SendImageSchema = z.object({
  phone: z.string(),
  imagePath: z.string(),
  caption: z.string().optional(),
});

/**
 * POST /send-image
 * Sends a WhatsApp image message to a customer phone number.
 * Used primarily for sending the QRIS payment QR code after invoice.
 */
export async function sendImage(req: Request, res: Response): Promise<void> {
  const parsed = SendImageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    return;
  }

  const { phone, imagePath, caption } = parsed.data;

  if (!isValidIndonesianNumber(phone)) {
    res.status(400).json({ error: 'Invalid Indonesian phone number' });
    return;
  }

  const allowed = await isCustomerAllowed(phone);
  if (!allowed) {
    res.status(403).json({ error: 'Phone not allowed by whitelist or blocked' });
    return;
  }

  const sock = getSocket();
  const status = getStatus();
  if (!sock || status !== 'READY') {
    res.status(503).json({ error: 'Bot not ready', status });
    return;
  }

  const targetNumber = formatPhoneNumber(phone);

  // Resolve image path (absolute or relative to cwd)
  const resolvedPath = path.isAbsolute(imagePath)
    ? imagePath
    : path.resolve(process.cwd(), imagePath);

  if (!fs.existsSync(resolvedPath)) {
    res.status(400).json({ error: `Image file not found: ${resolvedPath}` });
    return;
  }

  try {
    const imageBuffer = fs.readFileSync(resolvedPath);
    const result = await sock.sendMessage(targetNumber, {
      image: imageBuffer,
      caption: caption ?? '',
    });
    const msgId = result?.key?.id ?? 'unknown';
    recordBotSentMessageId(msgId);
    res.status(200).json({ success: true, messageId: msgId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to send image', details: message });
  }
}
