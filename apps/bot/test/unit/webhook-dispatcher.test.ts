import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  process.env.DATABASE_URL = 'postgresql://localhost:5432/sync_erp_test';
  process.env.CARLA_WEBHOOK_URL = 'http://127.0.0.1:8645/webhooks/whatsapp-inbound';
});

vi.mock('../../src/bot/owner-takeover', () => ({
  isSessionMuted: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../src/bot/frustration-detector', () => ({
  detectFrustration: vi.fn().mockResolvedValue({ detected: false, count: 0 }),
}));

vi.mock('../../src/bot/use-redis-auth-state', () => ({
  getRedisClient: vi.fn().mockReturnValue({
    get: vi.fn().mockResolvedValue('Catatan customer VIP'),
  }),
}));

vi.mock('../../src/utils/chat-history', () => ({
  getFormattedChatHistory: vi.fn().mockResolvedValue('Customer: halo kak\nAssistant: halo juga'),
}));

import { dispatchToWebhook } from '../../src/bot/webhook-dispatcher';

describe('Webhook Dispatcher Payload Verification', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches properly formatted Hermes schema variables to webhook', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    let capturedUrl: string | null = null;

    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedBody = JSON.parse(init?.body as string) as Record<string, unknown>;
      return Promise.resolve({
        ok: true,
        status: 200,
      } as Response);
    });

    await dispatchToWebhook(
      '6285158858310',
      '+6285158858310',
      'Dhoni Tester',
      'halo mau tanya kasur',
      '2026-09-25T11:00:00.000Z',
      null,
      null,
    );

    expect(capturedUrl).toBe('http://127.0.0.1:8645/webhooks/whatsapp-inbound');
    expect(capturedBody).not.toBeNull();
    expect(capturedBody).toMatchObject({
      customerPhone: '+6285158858310',
      customerName: 'Dhoni Tester',
      messageText: 'halo mau tanya kasur',
      chatHistory: 'Customer: halo kak\nAssistant: halo juga',
      timestamp: '2026-09-25T11:00:00.000Z',
      customerNotes: 'Catatan customer VIP',
      autoEscalation: 'None',
      phone: '+6285158858310',
      text: 'halo mau tanya kasur',
      customer_name: 'Dhoni Tester',
    });

    global.fetch = originalFetch;
  });
});
