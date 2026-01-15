import type { Request, Response } from 'express';
import { OrderPayloadSchema } from '../types/order';
import { getSocket, getStatus } from '../bot/baileys';
import { formatOrderMessage } from '../utils/formatter';
import {
  formatPhoneNumber,
  isValidIndonesianNumber,
} from '../utils/phone';
import { trpc } from '../lib/trpc';

// Type helper for error handling
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export const sendOrder = async (req: Request, res: Response) => {
  // 1. Validate Payload
  const result = OrderPayloadSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: 'Validation Error',
      details: result.error.issues,
    });
  }

  const payload = result.data;

  // 2. Validate Phone Number
  if (!isValidIndonesianNumber(payload.customerWhatsapp)) {
    return res.status(400).json({
      error: 'Invalid Phone Number',
      message:
        'Nomor WhatsApp tidak valid (Gunakan format 08... atau 62...)',
    });
  }

  // 3. Send WhatsApp Message directly (Pure Notifier)
  const sock = getSocket();

  // Determine URL (provided in payload or fallback, but logic should be simple)
  // Legacy used formatting logic.

  if (getStatus() !== 'READY' || !sock) {
    console.warn('Bot not ready, skipping WA message.');
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Bot WhatsApp belum siap.',
    });
  }

  // 4a. Verify Order via TRPC (if URL provided)
  if (payload.orderUrl) {
    try {
      // Extract token from URL
      const tokenMatch = payload.orderUrl.match(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
      );

      if (tokenMatch) {
        const token = tokenMatch[0];
        console.log(`[SendOrder] Verifying order via TRPC: ${token}`);

        const order = await trpc.publicRental.getByToken.query({
          token,
        });

        if (order.orderNumber !== payload.orderId) {
          console.warn(
            `[SendOrder] Order ID Mismatch! Payload: ${payload.orderId}, TRPC: ${order.orderNumber}`
          );
          // Optional: Reject request if strict
          // return res.status(400).json({ error: 'Order ID Mismatch' });
        }

        console.log(
          `[SendOrder] TRPC Verification Success: ${order.orderNumber} (${order.status})`
        );
      }
    } catch (err) {
      console.error('[SendOrder] TRPC Validation Failed:', err);
      // We continue - don't block notification on sync failure
    }
  }

  // Baileys format: 628xxx@s.whatsapp.net
  const targetNumber = formatPhoneNumber(
    payload.customerWhatsapp
  ).replace('@c.us', '@s.whatsapp.net');

  try {
    // 4b. Verify phone number existence on WhatsApp
    // This is crucial because sock.sendMessage() does not throw even if the number is invalid.
    console.log(
      `[SendOrder] Verifying number existence: ${targetNumber}`
    );
    const onWa = await sock.onWhatsApp(targetNumber);
    const exists = onWa && onWa[0]?.exists;

    if (!exists) {
      console.warn(
        `[SendOrder] Number not registered: ${targetNumber}`
      );
      return res.status(400).json({
        error: 'Invalid WhatsApp Number',
        message: 'Nomor WhatsApp tidak terdaftar atau tidak aktif',
      });
    }

    const message = formatOrderMessage(payload);

    const response = await sock.sendMessage(targetNumber, {
      text: message,
    });

    // eslint-disable-next-line no-console
    console.log(`Order notification sent to ${targetNumber}`);

    return res.status(200).json({
      success: true,
      messageId: response?.key?.id || 'unknown',
    });
  } catch (error: unknown) {
    console.error('[BotService] ERROR sending message:', error);

    const msg = getErrorMessage(error).toLowerCase();

    if (
      msg.includes('no lid') ||
      msg.includes('invalid') ||
      msg.includes('not registered')
    ) {
      return res.status(400).json({
        error: 'Invalid WhatsApp Number',
        message: 'Nomor WhatsApp tidak terdaftar atau tidak aktif',
      });
    }

    return res.status(500).json({
      error: 'Delivery Failed',
      message: 'Gagal mengirim pesan WhatsApp',
    });
  }
};
