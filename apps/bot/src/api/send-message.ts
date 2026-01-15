import type { Request, Response } from 'express';
import { z } from 'zod';
import { getSocket, getStatus } from '../bot/baileys';
import {
  formatPhoneNumber,
  isValidIndonesianNumber,
} from '../utils/phone';

const SendMessageSchema = z.object({
  phone: z.string(),
  message: z.string(),
});

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

  // 4. Send Message
  // Baileys expects format: 628xxx@s.whatsapp.net
  const targetNumber = formatPhoneNumber(phone).replace(
    '@c.us',
    '@s.whatsapp.net'
  );

  try {
    const response = await sock.sendMessage(targetNumber, {
      text: message,
    });

    // eslint-disable-next-line no-console
    console.log(`Message sent to ${targetNumber}`);

    return res.status(200).json({
      success: true,
      messageId: response?.key?.id || 'unknown',
    });
  } catch (error: unknown) {
    console.error('Failed to send message:', error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Gagal mengirim pesan WhatsApp';

    return res.status(500).json({
      error: 'Delivery Failed',
      message: errorMessage,
    });
  }
};
