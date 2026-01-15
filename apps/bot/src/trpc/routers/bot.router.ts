import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { OrderPayloadSchema } from '../../types/order';
import { getSocket, getStatus } from '../../bot/baileys';
import { formatOrderMessage } from '../../utils/formatter';
import {
  formatPhoneNumber,
  isValidIndonesianNumber,
} from '../../utils/phone';
import { TRPCError } from '@trpc/server';

export const botRouter = router({
  /**
   * Send Order Confirmation (Full Details)
   */
  sendOrder: protectedProcedure
    .input(OrderPayloadSchema)
    .mutation(async ({ input }) => {
      // 1. Validate Phone Number
      if (!isValidIndonesianNumber(input.customerWhatsapp)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Nomor WhatsApp tidak valid (Gunakan format 08... atau 62...)',
        });
      }

      // 2. Check Bot Status
      if (getStatus() !== 'READY') {
        throw new TRPCError({
          code: 'SERVICE_UNAVAILABLE',
          message: 'Bot WhatsApp belum siap. Hubungi admin.',
        });
      }

      const sock = getSocket();
      if (!sock) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal Error: Socket instance missing',
        });
      }

      // 3. Format Message & Target (Baileys format: 628xxx@s.whatsapp.net)
      const targetNumber = formatPhoneNumber(
        input.customerWhatsapp
      ).replace('@c.us', '@s.whatsapp.net');
      const message = formatOrderMessage(input);

      // 3.5 Check number existence on WhatsApp
      console.log(`[BotRouter] Verifying existence: ${targetNumber}`);
      const onWa = await sock.onWhatsApp(targetNumber);
      if (!onWa?.[0]?.exists) {
        console.warn(
          `[BotRouter] Number not registered: ${targetNumber}`
        );
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            '[INVALID_PHONE] Nomor WhatsApp tidak terdaftar atau tidak aktif',
        });
      }

      try {
        // 4. Send Message
        const response = await sock.sendMessage(targetNumber, {
          text: message,
        });

        // eslint-disable-next-line no-console
        console.log(
          `Order sent to ${targetNumber} (Payment: ${
            input.paymentMethod || 'pending'
          })`
        );

        return {
          success: true,
          messageId: response?.key?.id || 'unknown',
        };
      } catch (error: unknown) {
        console.error('[BotService] ERROR sending message:', error);

        const msg = (
          error instanceof Error ? error.message : ''
        ).toLowerCase();
        if (
          msg.includes('no lid') ||
          msg.includes('invalid') ||
          msg.includes('not registered')
        ) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              '[INVALID_PHONE] Nomor WhatsApp tidak terdaftar atau tidak aktif',
          });
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            error instanceof Error
              ? error.message
              : 'Gagal mengirim pesan WhatsApp',
        });
      }
    }),

  /**
   * Send Simple Message
   */
  sendMessage: protectedProcedure
    .input(
      z.object({
        phone: z.string(),
        message: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // 1. Validate Phone Number
      if (!isValidIndonesianNumber(input.phone)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Nomor WhatsApp tidak valid (Gunakan format 08... atau 62...)',
        });
      }

      // 2. Check Bot Status
      if (getStatus() !== 'READY') {
        throw new TRPCError({
          code: 'SERVICE_UNAVAILABLE',
          message: 'Bot WhatsApp belum siap. Hubungi admin.',
        });
      }

      const sock = getSocket();
      if (!sock) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal Error: Socket instance missing',
        });
      }

      // 3. Send Message (Baileys format: 628xxx@s.whatsapp.net)
      const targetNumber = formatPhoneNumber(input.phone).replace(
        '@c.us',
        '@s.whatsapp.net'
      );

      try {
        const response = await sock.sendMessage(targetNumber, {
          text: input.message,
        });
        // eslint-disable-next-line no-console
        console.log(`Message sent to ${targetNumber}`);

        return {
          success: true,
          messageId: response?.key?.id || 'unknown',
        };
      } catch (error: unknown) {
        console.error('Failed to send message:', error);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            error instanceof Error
              ? error.message
              : 'Gagal mengirim pesan WhatsApp',
        });
      }
    }),
});
