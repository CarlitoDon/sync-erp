import { z } from 'zod';
import { prisma, type WhatsappBotStatus } from '@sync-erp/database';
import { createEnvValidator, BOT_STATUS_TIMEOUT_MS } from '@sync-erp/shared';
import { sendTelegramAlert } from '../modules/common/utils/telegram-alert';

const botStatusResponseSchema = z.object({
  status: z.string().optional(),
  qrCode: z.string().nullable().optional(),
});

const env = createEnvValidator('api');

export const DEFAULT_DOWN_ALERT_AFTER_MIN = 5;
export const DEFAULT_COOLDOWN_MIN = 30;
export const HEARTBEAT_INTERVAL_MS = 150_000; // 2.5 minutes

export function getAlertAfterMs(): number {
  const min = Number(process.env.WHATSAPP_DOWN_ALERT_AFTER_MIN);
  return (Number.isFinite(min) && min > 0 ? min : DEFAULT_DOWN_ALERT_AFTER_MIN) * 60 * 1000;
}

export function getCooldownMs(): number {
  const min = Number(process.env.WHATSAPP_DOWN_ALERT_COOLDOWN_MIN);
  return (Number.isFinite(min) && min > 0 ? min : DEFAULT_COOLDOWN_MIN) * 60 * 1000;
}

export function createDefaultBotStatus(): WhatsappBotStatus {
  return {
    id: 'singleton',
    status: 'INITIALIZING',
    qr: null,
    lastError: null,
    lastErrorAt: null,
    lastAlertedAt: null,
    lastAlertState: null,
    aiSalesEnabled: true,
    updatedAt: new Date(),
  };
}

export async function getOrCreateBotStatus(): Promise<WhatsappBotStatus> {
  try {
    const existing = await prisma.whatsappBotStatus.findUnique({
      where: { id: 'singleton' },
    });
    if (existing) {
      return existing;
    }
    const created = await prisma.whatsappBotStatus.create({
      data: {
        id: 'singleton',
        status: 'INITIALIZING',
        qr: null,
        aiSalesEnabled: true,
      },
    });
    return created ?? createDefaultBotStatus();
  } catch (error) {
    console.warn(
      '[BotHeartbeat] Failed to get/create bot status from DB, using fallback:',
      error instanceof Error ? error.message : String(error)
    );
    return createDefaultBotStatus();
  }
}

export async function syncBotStatusFromService(): Promise<WhatsappBotStatus | null> {
  try {
    const botUrl = env.getBotUrl();
    const botSecret = env.getBotSecret();

    const response = await fetch(`${botUrl}/status`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${botSecret}` },
      signal: AbortSignal.timeout(BOT_STATUS_TIMEOUT_MS),
    });

    if (!response.ok) {
      return null;
    }

    const rawJson: unknown = await response.json().catch(() => null);
    const parsed = botStatusResponseSchema.safeParse(rawJson);

    if (!parsed.success || typeof parsed.data.status !== 'string') {
      return null;
    }

    const currentStatus = parsed.data.status;
    const qrCode = parsed.data.qrCode ?? null;

    const existing = await prisma.whatsappBotStatus.findUnique({
      where: { id: 'singleton' },
    });

    let lastError = existing?.lastError ?? null;
    let lastErrorAt = existing?.lastErrorAt ?? null;
    let lastAlertState = existing?.lastAlertState ?? null;

    if (currentStatus === 'READY') {
      lastError = null;
      lastErrorAt = null;
      if (existing?.lastAlertState === 'DOWN') {
        await sendTelegramAlert('✅ WhatsApp bot is BACK ONLINE (READY)');
        lastAlertState = 'RECOVERED';
      }
    }

    const upserted = await prisma.whatsappBotStatus.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        status: currentStatus,
        qr: qrCode,
        lastError,
        lastErrorAt,
        lastAlertState,
        aiSalesEnabled: true,
      },
      update: {
        status: currentStatus,
        qr: qrCode,
        lastError,
        lastErrorAt,
        lastAlertState,
      },
    });

    return (
      upserted ?? {
        id: 'singleton',
        status: currentStatus,
        qr: qrCode,
        lastError,
        lastErrorAt,
        lastAlertedAt: existing?.lastAlertedAt ?? null,
        lastAlertState,
        aiSalesEnabled: existing?.aiSalesEnabled ?? true,
        updatedAt: new Date(),
      }
    );
  } catch (error) {
    console.warn(
      '[BotHeartbeat] Failed to fetch live bot status:',
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

export async function checkAndTriggerBotAlerts(): Promise<WhatsappBotStatus> {
  const current = await getOrCreateBotStatus();
  const now = new Date();
  const alertAfterMs = getAlertAfterMs();
  const cooldownMs = getCooldownMs();

  const updatedAtTime = current.updatedAt ? new Date(current.updatedAt).getTime() : now.getTime();
  const isStale = (now.getTime() - updatedAtTime) > alertAfterMs;
  const isDown = isStale || current.status === 'DISCONNECTED';

  if (isDown) {
    const lastAlertedTime = current.lastAlertedAt ? new Date(current.lastAlertedAt).getTime() : null;
    const shouldAlert = !lastAlertedTime || (now.getTime() - lastAlertedTime) > cooldownMs;

    if (shouldAlert) {
      const minutesDown = Math.max(
        1,
        Math.round((now.getTime() - updatedAtTime) / 60000)
      );
      const errorMsg = current.lastError ? current.lastError : 'None';
      const alertText = `🚨 WhatsApp bot DOWN (${minutesDown} min) — last error: ${errorMsg}`;
      await sendTelegramAlert(alertText);

      try {
        const updated = await prisma.whatsappBotStatus.update({
          where: { id: 'singleton' },
          data: {
            lastAlertedAt: now,
            lastAlertState: 'DOWN',
          },
        });
        return updated ?? { ...current, lastAlertedAt: now, lastAlertState: 'DOWN' };
      } catch (err) {
        console.warn(
          '[BotHeartbeat] Failed to update lastAlertedAt:',
          err instanceof Error ? err.message : String(err)
        );
        return { ...current, lastAlertedAt: now, lastAlertState: 'DOWN' };
      }
    }
  } else if (current.status === 'READY' && current.lastAlertState === 'DOWN') {
    await sendTelegramAlert('✅ WhatsApp bot is BACK ONLINE (READY)');
    try {
      const updated = await prisma.whatsappBotStatus.update({
        where: { id: 'singleton' },
        data: {
          lastError: null,
          lastErrorAt: null,
          lastAlertState: 'RECOVERED',
        },
      });
      return (
        updated ?? {
          ...current,
          lastError: null,
          lastErrorAt: null,
          lastAlertState: 'RECOVERED',
        }
      );
    } catch {
      return {
        ...current,
        lastError: null,
        lastErrorAt: null,
        lastAlertState: 'RECOVERED',
      };
    }
  }

  return current;
}

export function startBotHeartbeatWorker(): () => void {
  let isRunning = false;

  const run = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      await syncBotStatusFromService();
      await checkAndTriggerBotAlerts();
    } catch (error) {
      console.error(
        '[BotHeartbeat] Worker failed run cycle:',
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      isRunning = false;
    }
  };

  const timer = setInterval(() => {
    void run();
  }, HEARTBEAT_INTERVAL_MS);

  timer.unref();

  return () => {
    clearInterval(timer);
  };
}
