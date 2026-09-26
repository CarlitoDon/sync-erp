import type { Request, Response } from 'express';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { getSocket, getStatus, recordBotSentMessageId } from '../bot/baileys';
import { formatPhoneNumber, isValidIndonesianNumber } from '../utils/phone';
import { isCustomerAllowed } from '../utils/whitelist';
import { releaseTurn } from '../bot/debounce-buffer';

const SendImageSchema = z.object({
  phone: z.string(),
  imagePath: z.string(),
  caption: z.string().optional(),
});

/**
 * POST /send-image
 * Sends a WhatsApp image message to a customer phone number.
 * Used for sending the QRIS payment QR code and SnK infographic.
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

  // Multi-candidate directory search (works seamlessly in Docker cwd=/app or host)
  const candidatePaths = [
    path.isAbsolute(imagePath) ? imagePath : path.resolve(process.cwd(), imagePath),
    path.resolve(process.cwd(), 'apps/bot', imagePath),
    path.resolve(__dirname, '../../', imagePath),
    path.resolve(__dirname, '../assets', path.basename(imagePath)),
    path.resolve('/app/apps/bot/assets', path.basename(imagePath)),
    path.resolve('/app/assets', path.basename(imagePath)),
  ];

  const resolvedPath = candidatePaths.find((p) => fs.existsSync(p));

  if (!resolvedPath) {
    res.status(400).json({
      error: `Image file not found: ${imagePath}`,
      searched: candidatePaths,
    });
    return;
  }

  const cleanPhone = phone.replace(/\D/g, '').replace(/^0/, '62');

  try {
    const imageBuffer = fs.readFileSync(resolvedPath);
    const result = await sock.sendMessage(targetNumber, {
      image: imageBuffer,
      caption: caption ?? '',
    });
    const msgId = result?.key?.id ?? 'unknown';
    recordBotSentMessageId(msgId);

    // Release turn lock
    await releaseTurn(cleanPhone, sock);

    res.status(200).json({ success: true, messageId: msgId });
  } catch (err: unknown) {
    await releaseTurn(cleanPhone, sock);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to send image', details: message });
  }
}
