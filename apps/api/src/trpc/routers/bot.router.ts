import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, botProcedure } from '../trpc';
import { createEnvValidator, BOT_STATUS_TIMEOUT_MS } from '@sync-erp/shared';

const env = createEnvValidator('api');

// Existing companies seed the administrative role as "Administrator".
// Keep that role equivalent to the canonical ADMIN/OWNER roles here.
const BOT_STATUS_ADMIN_ROLES = new Set([
  'ADMIN',
  'OWNER',
  'ADMINISTRATOR',
]);

const adminOrOwnerProcedure = protectedProcedure.use(
  ({ ctx, next }) => {
    const role = ctx.userRole?.toUpperCase();

    if (!role || !BOT_STATUS_ADMIN_ROLES.has(role)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Admin or Owner access required',
      });
    }

    return next();
  }
);

// In-memory cache for bot status (updated by bot push + direct fetch)
let botState = {
  status: 'INITIALIZING',
  qr: null as string | null,
  lastUpdated: new Date(),
};

/**
 * Fetch real-time status directly from the bot service.
 * Falls back to cached in-memory state on failure.
 */
async function fetchBotStatus(): Promise<typeof botState> {
  try {
    const botUrl = env.getBotUrl();
    const botSecret = env.getBotSecret();

    const response = await fetch(`${botUrl}/status`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${botSecret}` },
      signal: AbortSignal.timeout(BOT_STATUS_TIMEOUT_MS),
    });

    if (response.ok) {
      const data = (await response.json()) as {
        status: string;
        qrCode: string | null;
      };
      // Update cache with fresh data
      botState = {
        status: data.status,
        qr: data.qrCode,
        lastUpdated: new Date(),
      };
    }
  } catch (error) {
    // Bot unreachable — return cached state
    console.warn('[BotRouter] Failed to fetch bot status, using cache:', (error as Error).message);
  }
  return botState;
}

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

  getStatus: adminOrOwnerProcedure.query(async () => {
    // Always fetch real status from bot (fixes Passenger restart losing state)
    return fetchBotStatus();
  }),

  /**
   * Ping the bot — sends "pong" to admin phone via WhatsApp
   * Frontend calls this to verify bot is truly working end-to-end
   */
  ping: adminOrOwnerProcedure.mutation(async () => {
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
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message:
          (data as { error?: string }).error ||
          `Bot returned ${response.status}`,
      });
    }

    return data as {
      success: boolean;
      messageId: string;
      sentTo: string;
    };
  }),

  /**
   * Logout from WhatsApp — clears session and restarts for fresh QR
   */
  logout: adminOrOwnerProcedure.mutation(async () => {
    const botUrl = env.getBotUrl();
    const botSecret = env.getBotSecret();

    const response = await fetch(`${botUrl}/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${botSecret}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message:
          (data as { error?: string }).error ||
          `Bot returned ${response.status}`,
      });
    }

    return data as { success: boolean; message: string };
  }),
});
