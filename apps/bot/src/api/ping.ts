import type { Request, Response } from 'express';
import { getSocket, getStatus } from '../bot/baileys';
import {
  formatPhoneNumber,
  isValidIndonesianNumber,
} from '../utils/phone';

const ADMIN_PHONE = process.env.ADMIN_PHONE;

export const ping = async (_req: Request, res: Response) => {
  // 1. Check ADMIN_PHONE env var
  if (!ADMIN_PHONE) {
    return res.status(500).json({
      success: false,
      error: 'ADMIN_PHONE not configured in environment',
    });
  }

  // 2. Validate phone number format
  if (!isValidIndonesianNumber(ADMIN_PHONE)) {
    return res.status(500).json({
      success: false,
      error: 'ADMIN_PHONE is not a valid Indonesian number',
    });
  }

  // 3. Check bot status
  if (getStatus() !== 'READY') {
    return res.status(503).json({
      success: false,
      error: 'Bot is not connected to WhatsApp',
      status: getStatus(),
    });
  }

  const sock = getSocket();
  if (!sock) {
    return res.status(500).json({
      success: false,
      error: 'Socket instance not available',
    });
  }

  // 4. Send "pong" to admin
  const targetNumber = formatPhoneNumber(ADMIN_PHONE).replace(
    '@c.us',
    '@s.whatsapp.net'
  );

  const timestamp = new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
  });

  try {
    const response = await sock.sendMessage(targetNumber, {
      text: `🏓 *Pong!*\n\nBot is alive and connected.\n📅 ${timestamp}\n⏱️ Uptime: ${formatUptime(process.uptime())}`,
    });

    console.log(`[Ping] Pong sent to admin ${targetNumber}`);

    return res.status(200).json({
      success: true,
      messageId: response?.key?.id || 'unknown',
      sentTo: ADMIN_PHONE,
    });
  } catch (error: unknown) {
    console.error('[Ping] Failed to send pong:', error);
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to send message',
    });
  }
};

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}
