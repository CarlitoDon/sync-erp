import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { botRouter } from '@src/trpc/routers/bot.router';
import type { Context } from '@src/trpc/context';
import { mockPrisma, resetMocks } from './mocks/prisma.mock';
import { sendTelegramAlert } from '@src/modules/common/utils/telegram-alert';
import {
  checkAndTriggerBotAlerts,
  syncBotStatusFromService,
  getAlertAfterMs,
  getCooldownMs,
} from '@src/services/bot-heartbeat.service';
import type { WhatsappBotStatus } from '@sync-erp/database';

const BOT_URL = 'http://bot-observability.test';
const BOT_SECRET = 'bot-api-secret-2026';
const API_SECRET = 'test-api-secret-2026';
const TELEGRAM_TOKEN = 'test-telegram-token';
const TELEGRAM_CHAT_IDS = '8215203590,8923897744';

const fetchMock = vi.fn<typeof fetch>();

function createCaller(
  overrides: Partial<Context> = {}
): ReturnType<typeof botRouter.createCaller> {
  return botRouter.createCaller({
    req: {
      headers: {
        authorization: `Bearer ${API_SECRET}`,
      },
    } as unknown as Context['req'],
    res: {} as Context['res'],
    userId: 'test-admin-id',
    companyId: 'test-company-id',
    correlationId: 'test-correlation-id',
    idempotencyKey: undefined,
    businessShape: undefined,
    userRole: 'ADMIN',
    userPermissions: [],
    integrationId: undefined,
    isApiKeyAuth: false,
    permissions: undefined,
    apiKeyId: undefined,
    ...overrides,
  });
}

describe('WhatsApp Bot Observability & Emergency Cut Operation', () => {
  beforeEach(() => {
    resetMocks();
    vi.stubEnv('SYNC_ERP_BOT_URL', BOT_URL);
    vi.stubEnv('SYNC_ERP_BOT_SECRET', BOT_SECRET);
    vi.stubEnv('SYNC_ERP_API_SECRET', API_SECRET);
    vi.stubEnv('TELEGRAM_BOT_TOKEN', TELEGRAM_TOKEN);
    vi.stubEnv('TELEGRAM_ADMIN_CHAT_ID', TELEGRAM_CHAT_IDS);
    vi.stubEnv('WHATSAPP_DOWN_ALERT_AFTER_MIN', '5');
    vi.stubEnv('WHATSAPP_DOWN_ALERT_COOLDOWN_MIN', '30');
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  describe('Telegram Alert Utility', () => {
    it('skips alerting safely without throwing when credentials are unset', async () => {
      vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
      vi.stubEnv('TELEGRAM_ADMIN_CHAT_ID', '');

      const result = await sendTelegramAlert('test alert');
      expect(result).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends alert to multiple comma-separated chat IDs', async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );

      const result = await sendTelegramAlert('Test alert message');
      expect(result).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            chat_id: '8215203590',
            text: 'Test alert message',
          }),
        })
      );
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            chat_id: '8923897744',
            text: 'Test alert message',
          }),
        })
      );
    });

    it('returns true if at least one chat ID delivery succeeds', async () => {
      fetchMock
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ ok: false }), { status: 500 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ ok: true }), { status: 200 })
        );

      const result = await sendTelegramAlert('Partial success alert');
      expect(result).toBe(true);
    });

    it('handles fetch failures without throwing', async () => {
      fetchMock.mockRejectedValue(new Error('Network offline'));

      const result = await sendTelegramAlert('Failure test');
      expect(result).toBe(false);
    });

    it('returns false immediately when alert text is empty or blank', async () => {
      expect(await sendTelegramAlert('')).toBe(false);
      expect(await sendTelegramAlert('   \n  ')).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('Staleness & Bot Down Alerting', () => {
    it('parses alert after and cooldown minutes from environment variables with defaults', () => {
      expect(getAlertAfterMs()).toBe(5 * 60 * 1000);
      expect(getCooldownMs()).toBe(30 * 60 * 1000);

      vi.stubEnv('WHATSAPP_DOWN_ALERT_AFTER_MIN', '10');
      vi.stubEnv('WHATSAPP_DOWN_ALERT_COOLDOWN_MIN', '60');
      expect(getAlertAfterMs()).toBe(10 * 60 * 1000);
      expect(getCooldownMs()).toBe(60 * 60 * 1000);
    });

    it('flags stale: true and sends DOWN alert when bot has not been updated beyond threshold', async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const staleRecord: WhatsappBotStatus = {
        id: 'singleton',
        status: 'READY',
        qr: null,
        lastError: 'Socket timed out',
        lastErrorAt: tenMinutesAgo,
        lastAlertedAt: null,
        lastAlertState: null,
        aiSalesEnabled: true,
        updatedAt: tenMinutesAgo,
      };

      mockPrisma.whatsappBotStatus.findUnique.mockResolvedValue(staleRecord);
      mockPrisma.whatsappBotStatus.update.mockImplementation(
        (args: { data: Partial<WhatsappBotStatus> }) =>
          Promise.resolve({ ...staleRecord, ...args.data })
      );

      // Bot endpoint is unreachable on live sync
      fetchMock.mockRejectedValueOnce(new Error('Connection refused'));
      // Telegram endpoint succeeds
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );

      const caller = createCaller();
      const status = await caller.getStatus();

      expect(status.stale).toBe(true);
      expect(mockPrisma.whatsappBotStatus.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastAlertState: 'DOWN',
          }),
        })
      );

      // Expect Telegram alert dispatched with error text
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
        expect.objectContaining({
          body: expect.stringContaining('🚨 WhatsApp bot DOWN'),
        })
      );
    });

    it('respects cooldown and does not repeat DOWN alert within cooldown window', async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recordInCooldown: WhatsappBotStatus = {
        id: 'singleton',
        status: 'DISCONNECTED',
        qr: null,
        lastError: 'Session expired',
        lastErrorAt: tenMinutesAgo,
        lastAlertedAt: fiveMinutesAgo, // Alerted 5 min ago, cooldown is 30 min
        lastAlertState: 'DOWN',
        aiSalesEnabled: true,
        updatedAt: tenMinutesAgo,
      };

      mockPrisma.whatsappBotStatus.findUnique.mockResolvedValue(recordInCooldown);

      fetchMock.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await checkAndTriggerBotAlerts();

      expect(result.lastAlertState).toBe('DOWN');
      expect(mockPrisma.whatsappBotStatus.update).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalledWith(
        expect.stringContaining('api.telegram.org'),
        expect.anything()
      );
    });
  });

  describe('Recovery Alerts & Error Clearing', () => {
    it('sends recovery alert and clears error when transitioning from DOWN to READY via updateStatus', async () => {
      const downRecord: WhatsappBotStatus = {
        id: 'singleton',
        status: 'DISCONNECTED',
        qr: null,
        lastError: 'Fatal handshake failure',
        lastErrorAt: new Date(Date.now() - 15 * 60 * 1000),
        lastAlertedAt: new Date(Date.now() - 15 * 60 * 1000),
        lastAlertState: 'DOWN',
        aiSalesEnabled: true,
        updatedAt: new Date(Date.now() - 15 * 60 * 1000),
      };

      mockPrisma.whatsappBotStatus.findUnique.mockResolvedValue(downRecord);
      mockPrisma.whatsappBotStatus.upsert.mockImplementation(
        (args: { update: Partial<WhatsappBotStatus> }) =>
          Promise.resolve({ ...downRecord, ...args.update })
      );

      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );

      const caller = createCaller({ isApiKeyAuth: true });
      const result = await caller.updateStatus({
        status: 'READY',
        qr: null,
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.whatsappBotStatus.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            status: 'READY',
            lastError: null,
            lastErrorAt: null,
            lastAlertState: 'RECOVERED',
          }),
        })
      );

      // Verify recovery alert sent
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
        expect.objectContaining({
          body: expect.stringContaining('✅ WhatsApp bot is BACK ONLINE (READY)'),
        })
      );
    });

    it('records lastError and lastErrorAt when error is passed to updateStatus', async () => {
      const currentRecord: WhatsappBotStatus = {
        id: 'singleton',
        status: 'READY',
        qr: null,
        lastError: null,
        lastErrorAt: null,
        lastAlertedAt: null,
        lastAlertState: null,
        aiSalesEnabled: true,
        updatedAt: new Date(),
      };

      mockPrisma.whatsappBotStatus.findUnique.mockResolvedValue(currentRecord);
      mockPrisma.whatsappBotStatus.upsert.mockImplementation(
        (args: { update: Partial<WhatsappBotStatus> }) =>
          Promise.resolve({ ...currentRecord, ...args.update })
      );

      const caller = createCaller({ isApiKeyAuth: true });
      await caller.updateStatus({
        status: 'DISCONNECTED',
        qr: null,
        error: 'Rate limited by WhatsApp server',
      });

      expect(mockPrisma.whatsappBotStatus.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            status: 'DISCONNECTED',
            lastError: 'Rate limited by WhatsApp server',
            lastErrorAt: expect.any(Date),
          }),
        })
      );
    });

    it('does not send recovery alert if previous state was not DOWN', async () => {
      const initializingRecord: WhatsappBotStatus = {
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

      mockPrisma.whatsappBotStatus.findUnique.mockResolvedValue(initializingRecord);
      mockPrisma.whatsappBotStatus.upsert.mockImplementation(
        (args: { update: Partial<WhatsappBotStatus> }) =>
          Promise.resolve({ ...initializingRecord, ...args.update })
      );

      const caller = createCaller({ isApiKeyAuth: true });
      await caller.updateStatus({
        status: 'READY',
        qr: null,
      });

      expect(fetchMock).not.toHaveBeenCalledWith(
        expect.stringContaining('api.telegram.org'),
        expect.anything()
      );
    });
  });

  describe('Emergency Cut Operation (toggleAiSales)', () => {
    it('allows ADMIN or OWNER to toggle aiSalesEnabled', async () => {
      const activeStatus: WhatsappBotStatus = {
        id: 'singleton',
        status: 'READY',
        qr: null,
        lastError: null,
        lastErrorAt: null,
        lastAlertedAt: null,
        lastAlertState: null,
        aiSalesEnabled: true,
        updatedAt: new Date(),
      };

      mockPrisma.whatsappBotStatus.findUnique.mockResolvedValue(activeStatus);
      mockPrisma.whatsappBotStatus.update.mockResolvedValue({
        ...activeStatus,
        aiSalesEnabled: false,
      });

      const caller = createCaller({ userRole: 'ADMIN' });
      const cutResult = await caller.toggleAiSales({ enabled: false });

      expect(cutResult.success).toBe(true);
      expect(cutResult.aiSalesEnabled).toBe(false);
      expect(mockPrisma.whatsappBotStatus.update).toHaveBeenCalledWith({
        where: { id: 'singleton' },
        data: { aiSalesEnabled: false },
      });
    });

    it('inverts state when enabled argument is omitted in toggleAiSales', async () => {
      const activeStatus: WhatsappBotStatus = {
        id: 'singleton',
        status: 'READY',
        qr: null,
        lastError: null,
        lastErrorAt: null,
        lastAlertedAt: null,
        lastAlertState: null,
        aiSalesEnabled: true,
        updatedAt: new Date(),
      };

      mockPrisma.whatsappBotStatus.findUnique.mockResolvedValue(activeStatus);
      mockPrisma.whatsappBotStatus.update.mockResolvedValue({
        ...activeStatus,
        aiSalesEnabled: false,
      });

      const caller = createCaller({ userRole: 'OWNER' });
      const result = await caller.toggleAiSales();

      expect(result.aiSalesEnabled).toBe(false);
      expect(mockPrisma.whatsappBotStatus.update).toHaveBeenCalledWith({
        where: { id: 'singleton' },
        data: { aiSalesEnabled: false },
      });
    });

    it('rejects unauthorized roles from toggling aiSales', async () => {
      const caller = createCaller({ userRole: 'MEMBER' });

      await expect(caller.toggleAiSales({ enabled: false })).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'Admin or Owner access required',
      });
    });

    it('exposes getAiSalesStatus for bot client queries', async () => {
      const status: WhatsappBotStatus = {
        id: 'singleton',
        status: 'READY',
        qr: null,
        lastError: null,
        lastErrorAt: null,
        lastAlertedAt: null,
        lastAlertState: null,
        aiSalesEnabled: false,
        updatedAt: new Date(),
      };

      mockPrisma.whatsappBotStatus.findUnique.mockResolvedValue(status);

      const caller = createCaller({ isApiKeyAuth: true });
      const result = await caller.getAiSalesStatus();

      expect(result.aiSalesEnabled).toBe(false);
    });
  });

  describe('Live Bot Sync Persistence', () => {
    it('persists live status and qr code from bot endpoint to database singleton', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: 'READY', qrCode: null }),
          { status: 200 }
        )
      );

      const currentRecord: WhatsappBotStatus = {
        id: 'singleton',
        status: 'QR_PENDING',
        qr: 'data:image/png;base64,sample',
        lastError: null,
        lastErrorAt: null,
        lastAlertedAt: null,
        lastAlertState: null,
        aiSalesEnabled: true,
        updatedAt: new Date(),
      };

      mockPrisma.whatsappBotStatus.findUnique.mockResolvedValue(currentRecord);
      mockPrisma.whatsappBotStatus.upsert.mockResolvedValue({
        ...currentRecord,
        status: 'READY',
        qr: null,
      });

      const synced = await syncBotStatusFromService();

      expect(synced?.status).toBe('READY');
      expect(mockPrisma.whatsappBotStatus.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            status: 'READY',
            qr: null,
          }),
        })
      );
    });

    it('returns null and does not throw when bot returns invalid payload or non-200', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 12345 }), { status: 200 })
      );

      const synced = await syncBotStatusFromService();
      expect(synced).toBeNull();
      expect(mockPrisma.whatsappBotStatus.upsert).not.toHaveBeenCalled();
    });
  });

  describe('Ping & Logout Procedures (Type Hardening & Error Handling)', () => {
    it('executes ping mutation and validates strongly typed response', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            messageId: 'msg-12345',
            sentTo: '6285158858310',
          }),
          { status: 200 }
        )
      );

      const caller = createCaller({ userRole: 'ADMIN' });
      const result = await caller.ping();

      expect(result).toEqual({
        success: true,
        messageId: 'msg-12345',
        sentTo: '6285158858310',
      });
    });

    it('throws INTERNAL_SERVER_ERROR if bot returns error message on ping', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: 'WhatsApp socket is not connected' }),
          { status: 503 }
        )
      );

      const caller = createCaller({ userRole: 'ADMIN' });
      await expect(caller.ping()).rejects.toThrow('WhatsApp socket is not connected');
    });

    it('throws INTERNAL_SERVER_ERROR if bot returns malformed schema on ping', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ unexpected: 'shape' }),
          { status: 200 }
        )
      );

      const caller = createCaller({ userRole: 'ADMIN' });
      await expect(caller.ping()).rejects.toThrow('Invalid response from WhatsApp bot ping');
    });

    it('executes logout mutation and validates strongly typed response', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: true, message: 'Logged out successfully' }),
          { status: 200 }
        )
      );

      const caller = createCaller({ userRole: 'OWNER' });
      const result = await caller.logout();

      expect(result).toEqual({
        success: true,
        message: 'Logged out successfully',
      });
    });
  });
});
