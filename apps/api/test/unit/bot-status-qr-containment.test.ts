import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { botRouter } from '@src/trpc/routers/bot.router';
import type { Context } from '@src/trpc/context';

const BOT_URL = 'http://bot-status-containment.test';
const BOT_SECRET = 'status-containment-api-secret';
const QR_CODE = 'data:image/png;base64,status-containment-qr';

const fetchMock = vi.fn<typeof fetch>();

function createCaller(
  overrides: Partial<Context> = {}
): ReturnType<typeof botRouter.createCaller> {
  return botRouter.createCaller({
    req: { headers: {} } as Context['req'],
    res: {} as Context['res'],
    userId: 'status-containment-user',
    companyId: 'status-containment-company',
    correlationId: 'status-containment-test',
    idempotencyKey: undefined,
    businessShape: undefined,
    userRole: 'MEMBER',
    userPermissions: [],
    integrationId: undefined,
    isApiKeyAuth: false,
    permissions: undefined,
    apiKeyId: undefined,
    ...overrides,
  });
}

describe('API bot status QR containment', () => {
  beforeEach(() => {
    vi.stubEnv('SYNC_ERP_BOT_URL', BOT_URL);
    vi.stubEnv('SYNC_ERP_BOT_SECRET', BOT_SECRET);
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('rejects unauthenticated callers before the bot proxy is reached', async () => {
    const caller = createCaller({
      userId: undefined,
      companyId: undefined,
      userRole: undefined,
    });

    await expect(caller.getStatus()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects ordinary members before any cached or live QR can be returned', async () => {
    const caller = createCaller({ userRole: 'MEMBER' });

    await expect(caller.getStatus()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Admin or Owner access required',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps bot ping restricted to administrative roles', async () => {
    await expect(createCaller({ userRole: 'MEMBER' }).ping()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Admin or Owner access required',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps bot logout restricted to administrative roles', async () => {
    await expect(createCaller({ userRole: 'MEMBER' }).logout()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Admin or Owner access required',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['ADMIN', 'OWNER', 'Administrator'])(
    'allows %s to retrieve the protected pairing QR',
    async (userRole) => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: 'QR_PENDING', qrCode: QR_CODE }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        )
      );

      const result = await createCaller({ userRole }).getStatus();

      expect(result).toEqual(
        expect.objectContaining({
          status: 'QR_PENDING',
          qr: QR_CODE,
        })
      );
      expect(fetchMock).toHaveBeenCalledWith(
        `${BOT_URL}/status`,
        expect.objectContaining({
          method: 'GET',
          headers: { Authorization: `Bearer ${BOT_SECRET}` },
        })
      );
    }
  );
});
