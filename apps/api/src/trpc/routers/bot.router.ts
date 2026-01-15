import { z } from 'zod';
import { router, protectedProcedure, botProcedure } from '../trpc';

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
});
