import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, botProcedure } from '../trpc';
import { createEnvValidator } from '@sync-erp/shared';
import { prisma } from '@sync-erp/database';
import { sendTelegramAlert } from '../../modules/common/utils/telegram-alert';
import {
  getAlertAfterMs,
  getOrCreateBotStatus,
  syncBotStatusFromService,
  checkAndTriggerBotAlerts,
} from '../../services/bot-heartbeat.service';

const env = createEnvValidator('api');

// Existing companies seed the administrative role as "Administrator".
// Keep that role equivalent to the canonical ADMIN/OWNER roles here.
const BOT_STATUS_ADMIN_ROLES = new Set([
  'ADMIN',
  'OWNER',
  'ADMINISTRATOR',
]);

const botPingResponseSchema = z.object({
  success: z.boolean(),
  messageId: z.string(),
  sentTo: z.string(),
});

const botLogoutResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

const botErrorResponseSchema = z.object({
  error: z.string().optional(),
});

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
        error: z.string().max(500).nullish(),
      })
    )
    .mutation(async ({ input }) => {
      const existing = await prisma.whatsappBotStatus.findUnique({
        where: { id: 'singleton' },
      });

      let lastError = existing?.lastError ?? null;
      let lastErrorAt = existing?.lastErrorAt ?? null;
      let lastAlertState = existing?.lastAlertState ?? null;

      if (input.error && input.error.trim().length > 0) {
        lastError = input.error.trim();
        lastErrorAt = new Date();
      }

      if (input.status === 'READY') {
        lastError = null;
        lastErrorAt = null;
        if (existing?.lastAlertState === 'DOWN') {
          await sendTelegramAlert('✅ WhatsApp bot is BACK ONLINE (READY)');
          lastAlertState = 'RECOVERED';
        }
      }

      const updated = await prisma.whatsappBotStatus.upsert({
        where: { id: 'singleton' },
        create: {
          id: 'singleton',
          status: input.status,
          qr: input.qr,
          lastError,
          lastErrorAt,
          lastAlertState,
          aiSalesEnabled: true,
        },
        update: {
          status: input.status,
          qr: input.qr,
          lastError,
          lastErrorAt,
          lastAlertState,
        },
      });

      if (input.status === 'DISCONNECTED') {
        await checkAndTriggerBotAlerts();
      }

      return {
        success: true,
        aiSalesEnabled: updated?.aiSalesEnabled ?? true,
      };
    }),

  getStatus: adminOrOwnerProcedure.query(async () => {
    const synced = await syncBotStatusFromService();
    const record = await checkAndTriggerBotAlerts();

    const status = synced?.status ?? record.status;
    const qr = synced ? synced.qr : record.qr;
    const updatedAt = synced?.updatedAt ?? record.updatedAt;

    const now = new Date();
    const updatedAtTime = updatedAt
      ? new Date(updatedAt).getTime()
      : now.getTime();
    const stale = now.getTime() - updatedAtTime > getAlertAfterMs();

    return {
      status,
      qr,
      lastUpdated: updatedAt,
      lastError: record.lastError,
      lastErrorAt: record.lastErrorAt,
      stale,
      lastAlertedAt: record.lastAlertedAt,
      aiSalesEnabled: record.aiSalesEnabled,
    };
  }),

  toggleAiSales: adminOrOwnerProcedure
    .input(
      z
        .object({
          enabled: z.boolean().optional(),
        })
        .optional()
    )
    .mutation(async ({ input }) => {
      const current = await getOrCreateBotStatus();
      const nextState =
        input?.enabled !== undefined ? input.enabled : !current.aiSalesEnabled;
      const updated = await prisma.whatsappBotStatus.update({
        where: { id: 'singleton' },
        data: { aiSalesEnabled: nextState },
      });
      return {
        success: true,
        aiSalesEnabled: updated.aiSalesEnabled,
      };
    }),

  getAiSalesStatus: botProcedure.query(async () => {
    const current = await getOrCreateBotStatus();
    return { aiSalesEnabled: current.aiSalesEnabled };
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

    const rawData: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const parsedError = botErrorResponseSchema.safeParse(rawData);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message:
          parsedError.success && parsedError.data.error
            ? parsedError.data.error
            : `Bot returned ${response.status}`,
      });
    }

    const parsed = botPingResponseSchema.safeParse(rawData);
    if (!parsed.success) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Invalid response from WhatsApp bot ping',
      });
    }

    return parsed.data;
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

    const rawData: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const parsedError = botErrorResponseSchema.safeParse(rawData);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message:
          parsedError.success && parsedError.data.error
            ? parsedError.data.error
            : `Bot returned ${response.status}`,
      });
    }

    const parsed = botLogoutResponseSchema.safeParse(rawData);
    if (!parsed.success) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Invalid response from WhatsApp bot logout',
      });
    }

    return parsed.data;
  }),
});
