import { z } from 'zod';
import { router, protectedProcedure, botProcedure } from '../trpc';
import { createEnvValidator } from '@sync-erp/shared';

const env = createEnvValidator('api');

// In-memory store (Reset on restart)
// For production, this should be Redis
let botState = {
  status: 'INITIALIZING',
  qr: null as string | null,
  lastUpdated: new Date(),
};

export const botRouter = router({
  updateStatus: botProcedure
    .input(
      z.object({
        status: z.enum([
          'INITIALIZING',
          'QR_PENDING',
          'READY',
          'DISCONNECTED',
        ]),
        qr: z.string().nullable(),
      })
    )
    .mutation(({ input }) => {
      botState = {
        status: input.status,
        qr: input.qr,
        lastUpdated: new Date(),
      };
      return { success: true };
    }),

  getStatus: protectedProcedure.query(() => {
    return botState;
  }),

  /**
   * Ping the bot — sends "pong" to admin phone via WhatsApp
   * Frontend calls this to verify bot is truly working end-to-end
   */
  ping: protectedProcedure.mutation(async () => {
    const botUrl = env.getBotUrl();
    const botSecret = env.getBotSecret();

    const response = await fetch(`${botUrl}/ping`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${botSecret}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || `Bot returned ${response.status}`
      );
    }

    return data as {
      success: boolean;
      messageId: string;
      sentTo: string;
    };
  }),
});
