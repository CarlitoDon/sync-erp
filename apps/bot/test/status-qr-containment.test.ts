import type { Server } from 'node:http';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const BOT_SECRET = 'status-containment-bot-secret';
const QR_CODE = 'data:image/png;base64,status-containment-qr';
const originalBotSecret = process.env.SYNC_ERP_BOT_SECRET;

process.env.SYNC_ERP_BOT_SECRET = BOT_SECRET;

vi.mock('../src/bot/baileys', () => ({
  getStatus: () => 'QR_PENDING',
  getQrDataUrl: () => QR_CODE,
}));

const { default: app } = await import('../src/server');

describe('Bot status QR containment', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = await new Promise<Server>((resolve, reject) => {
      const instance = app.listen(0, () => resolve(instance));
      instance.on('error', reject);
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Test server did not bind to a TCP address');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    process.env.SYNC_ERP_BOT_SECRET = BOT_SECRET;
  });

  afterEach(() => {
    process.env.SYNC_ERP_BOT_SECRET = BOT_SECRET;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });

    if (originalBotSecret === undefined) {
      delete process.env.SYNC_ERP_BOT_SECRET;
    } else {
      process.env.SYNC_ERP_BOT_SECRET = originalBotSecret;
    }
  });

  it('rejects unauthenticated status requests without returning QR', async () => {
    const response = await fetch(`${baseUrl}/status`);
    const body = await response.text();

    expect(response.status).toBe(401);
    expect(body).not.toContain(QR_CODE);
  });

  it('rejects ordinary bearer tokens without returning QR', async () => {
    const response = await fetch(`${baseUrl}/status`, {
      headers: { Authorization: 'Bearer not-the-bot-secret' },
    });
    const body = await response.text();

    expect(response.status).toBe(403);
    expect(body).not.toContain(QR_CODE);
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
  ])('fails closed when the configured secret is %s', async (_label, secret) => {
    if (secret === undefined) {
      delete process.env.SYNC_ERP_BOT_SECRET;
    } else {
      process.env.SYNC_ERP_BOT_SECRET = secret;
    }

    const response = await fetch(`${baseUrl}/status`, {
      headers: { Authorization: `Bearer ${BOT_SECRET}` },
    });
    const body = await response.text();

    expect(response.status).toBe(403);
    expect(body).not.toContain(QR_CODE);
  });

  it('keeps public health liveness useful and QR-free', async () => {
    const response = await fetch(`${baseUrl}/health`);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body).not.toHaveProperty('qrCode');
    expect(body).not.toHaveProperty('qr');
    expect(JSON.stringify(body)).not.toContain(QR_CODE);
  });

  it('returns QR only with the configured bot bearer secret', async () => {
    const response = await fetch(`${baseUrl}/status`, {
      headers: { Authorization: `Bearer ${BOT_SECRET}` },
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: 'QR_PENDING', qrCode: QR_CODE });
  });
});
