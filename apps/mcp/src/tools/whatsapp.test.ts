import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateDeliveryFee,
  buildLeadCard,
  EscalateArgsSchema,
  EscalatedLeadPayloadSchema,
  RentalOrderAutoBookLeadArgsSchema,
  LAST_ESCALATION_KEY_PREFIX,
  LAST_ESCALATION_TTL,
  getWhatsAppTools,
} from './whatsapp.js';
import { normalizePhone, formatRaraMessageWithSignature } from '@sync-erp/shared/whatsapp';
import { getWhatsAppConfig, resetWhatsAppConfig } from '../config.js';
import { Redis } from 'ioredis';

// ---------------------------------------------------------------------------
// In-Memory Mock Redis for CI/Unit Tests (zero dependency on live Redis)
// ---------------------------------------------------------------------------
const { MockRedis } = vi.hoisted(() => {
  const storage = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const ttls = new Map<string, number>();

  class MockRedis {
    async get(key: string): Promise<string | null> {
      return storage.get(key) ?? null;
    }
    async set(key: string, value: string, mode?: string, ttl?: number): Promise<'OK'> {
      storage.set(key, value);
      if (mode === 'EX' && typeof ttl === 'number') {
        ttls.set(key, ttl);
      }
      return 'OK';
    }
    async del(...keys: string[]): Promise<number> {
      let count = 0;
      for (const key of keys) {
        if (storage.delete(key)) count++;
        if (sets.delete(key)) count++;
        ttls.delete(key);
      }
      return count;
    }
    async sadd(key: string, ...members: string[]): Promise<number> {
      if (!sets.has(key)) sets.set(key, new Set());
      for (const member of members) {
        sets.get(key)!.add(member);
      }
      return members.length;
    }
    async srem(key: string, ...members: string[]): Promise<number> {
      const s = sets.get(key);
      if (!s) return 0;
      let count = 0;
      for (const member of members) {
        if (s.delete(member)) count++;
      }
      return count;
    }
    async sismember(key: string, member: string): Promise<number> {
      const s = sets.get(key);
      return s && s.has(member) ? 1 : 0;
    }
    async smembers(key: string): Promise<string[]> {
      const s = sets.get(key);
      return s ? Array.from(s) : [];
    }
    async scard(key: string): Promise<number> {
      return sets.get(key)?.size ?? 0;
    }
    async ttl(key: string): Promise<number> {
      return ttls.get(key) ?? -1;
    }
    disconnect(): void {}
  }

  return { MockRedis };
});

vi.mock('ioredis', () => ({
  Redis: MockRedis,
  default: MockRedis,
}));

describe('WhatsApp Sales Bot MCP Tools', () => {
  describe('Phone Normalization', () => {
    it('converts leading 0 to 62 prefix', () => {
      expect(normalizePhone('081234567890')).toBe('6281234567890');
    });

    it('strips non-digits and preserves international 62 format', () => {
      expect(normalizePhone('+62 812-3456-7890')).toBe('6281234567890');
    });

    it('handles clean 62 numbers', () => {
      expect(normalizePhone('6285158858310')).toBe('6285158858310');
    });
  });

  describe('Delivery Fee Calculator Logic (Santi Living formula)', () => {
    it('returns 0 when distance is 0 or negative', () => {
      expect(calculateDeliveryFee(0)).toBe(0);
      expect(calculateDeliveryFee(-5)).toBe(0);
    });

    it('calculates fuel-based delivery fee and rounds up to nearest 1,000', () => {
      // Formula: ((distanceKm * 4) / 10) * 10,000 = distanceKm * 4,000
      // 5 km -> 5 * 4,000 = 20,000
      expect(calculateDeliveryFee(5)).toBe(20000);

      // 12.3 km -> 12.3 * 4000 = 49,200 -> ceil to 1000 = 50,000
      expect(calculateDeliveryFee(12.3)).toBe(50000);

      // 0.1 km -> 0.1 * 4000 = 400 -> ceil to 1000 = 1000
      expect(calculateDeliveryFee(0.1)).toBe(1000);
    });
  });

  describe('Lead Card Builder', () => {
    it('formats context-aware lead card for discount request', () => {
      const card = buildLeadCard({
        customerName: 'Budi Santoso',
        customerPhone: '081234567890',
        productInterest: 'Kasur Busa 160x200 + Bantal',
        escalationReason: 'Minta diskon 20% karena sewa 6 bulan',
        leadSummary: 'Customer butuh kasur untuk kos, minta potongan harga.',
        urgencyLevel: 'high',
      });

      expect(card).toContain('🏷️ PENGAJUAN DISKON / NEGO HARGA');
      expect(card).toContain('👤 Nama: Budi Santoso');
      expect(card).toContain('📱 WA: 081234567890');
      expect(card).toContain('🎯 Minat: Kasur Busa 160x200 + Bantal');
      expect(card).toContain('⏱️ Urgensi: 🟠 HIGH');
      expect(card).toContain('Minta diskon 20% karena sewa 6 bulan');
      expect(card).toContain('• "Kasih diskon [X]%" / "acc" → saya update harga & WA customer');
      expect(card).toContain('• "Take over" → saya mute, kamu handle langsung');
    });

    it('formats context-aware lead card for payment verification', () => {
      const card = buildLeadCard({
        customerName: 'Meiny',
        customerPhone: '081234567890',
        productInterest: 'Paket Single 90 x 3 unit',
        escalationReason: 'Customer mengonfirmasi pembayaran DP / kirim bukti transfer.',
        leadSummary: 'Transfer DP Rp52.000 via QRIS sudah dikirim. Total order Rp173.000.',
        urgencyLevel: 'high',
      });

      expect(card).toContain('💳 KONFIRMASI PEMBAYARAN DP');
      expect(card).toContain('👤 Nama: Meiny');
      expect(card).toContain('• "acc bayar" / "sudah masuk" → saya konfirmasi booking sah ke customer');
      expect(card).toContain('• "belum masuk" → saya minta customer cek transaksi/mutasi');
      expect(card).toContain('• "Take over" → saya mute, kamu handle langsung');
    });

    it('validates required fields with EscalateArgsSchema', () => {
      const invalid = EscalateArgsSchema.safeParse({
        customerName: 'Budi',
        // missing required fields
      });
      expect(invalid.success).toBe(false);

      const valid = EscalateArgsSchema.safeParse({
        customerName: 'Budi',
        customerPhone: '081234567890',
        productInterest: 'Kasur',
        escalationReason: 'Reason',
        leadSummary: 'Summary',
        urgencyLevel: 'medium',
      });
      expect(valid.success).toBe(true);
    });
  });

  describe('WhatsApp Tools Registry', () => {
    it('registers all 13 WhatsApp tools with correct names and schemas', () => {
      const tools = getWhatsAppTools();
      expect(tools.length).toBe(13);

      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toEqual([
        'whatsapp_send_message',
        'estimate_delivery_fee',
        'set_customer_note',
        'escalate_to_owner',
        'manage_customer_whitelist',
        'take_over_conversation',
        'return_to_bot',
        'resume_bot',
        'get_last_escalated_lead',
        'whatsapp_send_qris',
        'rental_order_auto_book_lead',
        'resolve_customer_location',
        'whatsapp_send_snk',
      ]);

      // Every tool must have a handler function and an input schema
      for (const tool of tools) {
        expect(typeof tool.handler).toBe('function');
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
      }
    });
  });

  describe('WhatsApp Configuration Schema', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      resetWhatsAppConfig();
    });

    afterEach(() => {
      process.env = { ...originalEnv };
      resetWhatsAppConfig();
    });

    it('loads defaults when optional env vars are omitted', () => {
      delete process.env.WHATSAPP_BOT_URL;
      delete process.env.WHATSAPP_BOT_SECRET;
      delete process.env.GOOGLE_MAPS_API_KEY;
      delete process.env.REDIS_URL;
      delete process.env.RARA_TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_BOT_TOKEN;

      const config = getWhatsAppConfig();
      expect(config.botUrl).toBe('http://127.0.0.1:3060');
      expect(config.redisUrl).toBe('redis://127.0.0.1:6379');
      expect(config.botSecret).toBe('');
      expect(config.raraTelegramBotToken).toBe('');
    });

    it('loads RARA_TELEGRAM_BOT_TOKEN when configured', () => {
      process.env.RARA_TELEGRAM_BOT_TOKEN = 'test_token_123';
      const config = getWhatsAppConfig();
      expect(config.raraTelegramBotToken).toBe('test_token_123');
    });

    it('escalate_to_owner fails when RARA_TELEGRAM_BOT_TOKEN is missing', async () => {
      delete process.env.RARA_TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_BOT_TOKEN;
      resetWhatsAppConfig();

      const tool = getWhatsAppTools().find((t) => t.name === 'escalate_to_owner');
      expect(tool).toBeDefined();

      await expect(
        tool!.handler({
          customerName: 'Budi Santoso',
          customerPhone: '081234567890',
          productInterest: 'Kasur Busa',
          escalationReason: 'Nego diskon',
          leadSummary: 'Customer minta diskon',
          urgencyLevel: 'high',
        })
      ).rejects.toThrow('RARA_TELEGRAM_BOT_TOKEN is not configured');
    });

    it('rejects escalating internal staff (Admin 1 +6281249182155) to owner', async () => {
      const tool = getWhatsAppTools().find((t) => t.name === 'escalate_to_owner');
      expect(tool).toBeDefined();

      await expect(
        tool!.handler({
          customerName: 'Admin 1 Sales Santi Mebel',
          customerPhone: '081249182155',
          productInterest: 'Kursi Napolly',
          escalationReason: 'Nota',
          leadSummary: 'Pesan kursi napolly',
          urgencyLevel: 'high',
        })
      ).rejects.toThrow('Cannot escalate internal staff or store conversation to owner');
    });

    it('allows setting customer note for phone number', async () => {
      const tool = getWhatsAppTools().find((t) => t.name === 'set_customer_note');
      expect(tool).toBeDefined();

      const result = await tool!.handler({
        phone: '081249182155',
        note: 'Staff internal',
      });
      expect(result).toContain('"success":true');
    });
  });

  describe('whatsapp_send_message handler', () => {
    it('parses multi-bubble response and returns messageIds and bubbleCount', async () => {
      const tool = getWhatsAppTools().find((t) => t.name === 'whatsapp_send_message');
      expect(tool).toBeDefined();

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          messageId: 'msg-last',
          messageIds: ['msg-1', 'msg-last'],
          bubbleCount: 2,
        }),
      } as unknown as Response);

      try {
        const resultJson = await tool!.handler({
          phone: '08123456789',
          message: 'halo kak 😊\n---\nrencana sewa mau kapan ya kak?',
        });
        const parsed = JSON.parse(resultJson);
        expect(parsed.success).toBe(true);
        expect(parsed.bubbleCount).toBe(2);
        expect(parsed.messageIds).toEqual(['msg-1', 'msg-last']);
        expect(parsed.messageId).toBe('msg-last');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

      it('verifies that whatsapp_send_message always appends -r to the final bubble in outbound payload', async () => {
        const tool = getWhatsAppTools().find((t) => t.name === 'whatsapp_send_message');
        expect(tool).toBeDefined();

        let capturedPayload: unknown = null;
        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
          if (init?.body) {
            capturedPayload = JSON.parse(String(init.body));
          }
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              messageId: 'msg-outbound',
              bubbleCount: 2,
            }),
          } as Response);
        });

        try {
          await tool!.handler({
            phone: '08123456789',
            message: 'halo kak 😊\n---\nrencana sewa mau kapan ya kak?',
          });

          expect(capturedPayload).not.toBeNull();
          const payload = capturedPayload as { phone: string; message: string };
          expect(payload.phone).toBe('08123456789');
          // First bubble has NO -r
          expect(payload.message).toContain('halo kak 😊');
          // Final bubble ends with -r
          expect(payload.message).toMatch(/rencana sewa mau kapan ya kak\?\n\n-r$/);
        } finally {
          globalThis.fetch = originalFetch;
        }
      });

      it('handles rejection from bot when number is disallowed', async () => {
        const tools = getWhatsAppTools();
        const tool = tools.find((t) => t.name === 'whatsapp_send_message');
        expect(tool).toBeDefined();

        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            error: 'Forbidden',
            message: 'Nomor penerima tidak diizinkan oleh whitelist atau diblokir proteksi staf.',
          }),
        });

        try {
          await expect(
            tool!.handler({
              phone: '081249182155',
              message: 'halo kak',
            })
          ).rejects.toThrow('WhatsApp send failed: Nomor penerima tidak diizinkan');
        } finally {
          globalThis.fetch = originalFetch;
        }
      });
  });

  describe('formatRaraMessageWithSignature (Rara -r Signature Tag Guardrail)', () => {
    it('appends -r on a new line to a single bubble without signature', () => {
      expect(formatRaraMessageWithSignature('halo kak')).toBe('halo kak\n\n-r');
    });

    it('does not double-append if single bubble already ends with -r', () => {
      expect(formatRaraMessageWithSignature('halo kak\n\n-r')).toBe('halo kak\n\n-r');
      expect(formatRaraMessageWithSignature('halo kak\n-r')).toBe('halo kak\n\n-r');
      expect(formatRaraMessageWithSignature('halo kak -r')).toBe('halo kak\n\n-r');
    });

    it('appends -r to the final bubble in multi-bubble messages and keeps bubble 1 clean', () => {
      const input = 'halo kak 😊\n---\nrencana sewa mau kapan ya kak?';
      const result = formatRaraMessageWithSignature(input);
      expect(result).toBe('halo kak 😊\n---\nrencana sewa mau kapan ya kak?\n\n-r');
    });

    it('does not duplicate -r if the final bubble already ends with -r', () => {
      const input = 'halo kak 😊\n---\nrencana sewa mau kapan ya kak?\n\n-r';
      const result = formatRaraMessageWithSignature(input);
      expect(result).toBe('halo kak 😊\n---\nrencana sewa mau kapan ya kak?\n\n-r');
    });

    it('strips -r from non-final bubbles and ensures only the final bubble has -r', () => {
      const input = 'halo kak 😊\n\n-r\n---\nrencana sewa mau kapan ya kak?\n\n-r';
      const result = formatRaraMessageWithSignature(input);
      expect(result).toBe('halo kak 😊\n---\nrencana sewa mau kapan ya kak?\n\n-r');
    });

    it('handles 3-bubble messages correctly', () => {
      const input = 'halo kak 😊\n---\nini pricelist kami yaa kak\n---\nrencana untuk kapan ya kak?';
      const result = formatRaraMessageWithSignature(input);
      expect(result).toBe('halo kak 😊\n---\nini pricelist kami yaa kak\n---\nrencana untuk kapan ya kak?\n\n-r');
    });

    it('returns empty string if input is empty or whitespace', () => {
      expect(formatRaraMessageWithSignature('')).toBe('');
      expect(formatRaraMessageWithSignature('   ')).toBe('   ');
    });
  });

  describe('manage_customer_whitelist', () => {
    it('allows adding phone number to whitelist in Redis', async () => {
      const tools = getWhatsAppTools();
      const tool = tools.find((t) => t.name === 'manage_customer_whitelist');
      expect(tool).toBeDefined();

      const result = await tool!.handler({
        action: 'add',
        phone: '081249182155',
      });
      expect(result).toContain('"success":true');
      expect(result).toContain('"action":"add"');
    });

    it('allows adding tester/leadership number to whitelist in Redis', async () => {
      const tools = getWhatsAppTools();
      const tool = tools.find((t) => t.name === 'manage_customer_whitelist');
      expect(tool).toBeDefined();

      const result = await tool!.handler({
        action: 'add',
        phone: '085158858310',
      });
      expect(result).toContain('"success":true');
      expect(result).toContain('"phone":"6285158858310"');
    });
  });

  describe('Escalation State Bridge (escalate_to_owner & get_last_escalated_lead)', () => {
    const testChatId = '8215203590';
    const testRedisKey = `${LAST_ESCALATION_KEY_PREFIX}${testChatId}`;
    let redis: Redis;

    beforeEach(() => {
      redis = new Redis('redis://127.0.0.1:6379', { lazyConnect: true });
    });

    afterEach(async () => {
      await redis.del(testRedisKey);
      await redis.del(`${LAST_ESCALATION_KEY_PREFIX}9999999999`);
      redis.disconnect();
    });

    it('escalate_to_owner saves escalation payload to Redis with 1-hour TTL', async () => {
      process.env.RARA_TELEGRAM_BOT_TOKEN = 'mock_rara_token';
      resetWhatsAppConfig();

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      } as unknown as Response);

      try {
        const tool = getWhatsAppTools().find((t) => t.name === 'escalate_to_owner');
        expect(tool).toBeDefined();

        const resJson = await tool!.handler({
          customerName: 'Santi Living Jogja',
          customerPhone: '082241851577',
          productInterest: '5 kasur 120x200 5 hari',
          escalationReason: 'Minta diskon sewa 5 kasur',
          leadSummary: 'Customer sewa 5 kasur 120x200 untuk event keluarga 5 hari.',
          urgencyLevel: 'high',
        });

        const parsed = JSON.parse(resJson);
        expect(parsed.success).toBe(true);
        expect(parsed.lastEscalationSaved).toBe(true);
        expect(parsed.customerPhone).toBe('6282241851577');

        // Check Redis state
        const savedRaw = await redis.get(testRedisKey);
        expect(savedRaw).toBeDefined();
        const savedLead = JSON.parse(savedRaw!);
        expect(savedLead.customerName).toBe('Santi Living Jogja');
        expect(savedLead.customerPhone).toBe('6282241851577');
        expect(savedLead.productInterest).toBe('5 kasur 120x200 5 hari');
        expect(savedLead.urgencyLevel).toBe('high');
        expect(savedLead.escalatedAt).toBeDefined();

        // Check TTL is approximately 3600 (within 3500-3600)
        const ttl = await redis.ttl(testRedisKey);
        expect(ttl).toBeGreaterThan(3500);
        expect(ttl).toBeLessThanOrEqual(LAST_ESCALATION_TTL);
      } finally {
        globalThis.fetch = originalFetch;
        delete process.env.RARA_TELEGRAM_BOT_TOKEN;
        resetWhatsAppConfig();
      }
    });

    it('get_last_escalated_lead returns found: false when no escalation exists', async () => {
      await redis.del(testRedisKey);

      const tool = getWhatsAppTools().find((t) => t.name === 'get_last_escalated_lead');
      expect(tool).toBeDefined();

      const resJson = await tool!.handler({});
      const parsed = JSON.parse(resJson);
      expect(parsed.found).toBe(false);
      expect(parsed.message).toContain('No active escalated lead found');
    });

    it('get_last_escalated_lead returns lead when present in Redis', async () => {
      const mockLead = {
        customerPhone: '6282241851577',
        customerName: 'Santi Living Jogja',
        productInterest: '5 kasur 120x200 5 hari',
        escalationReason: 'Nego harga promo',
        leadSummary: 'Permintaan diskon 10%',
        urgencyLevel: 'high',
        escalatedAt: new Date().toISOString(),
      };
      await redis.set(testRedisKey, JSON.stringify(mockLead), 'EX', 3600);

      const tool = getWhatsAppTools().find((t) => t.name === 'get_last_escalated_lead');
      expect(tool).toBeDefined();

      const resJson = await tool!.handler({});
      const parsed = JSON.parse(resJson);
      expect(parsed.found).toBe(true);
      expect(parsed.lead.customerName).toBe('Santi Living Jogja');
      expect(parsed.lead.customerPhone).toBe('6282241851577');
      expect(parsed.lead.productInterest).toBe('5 kasur 120x200 5 hari');
      expect(parsed.lead.urgencyLevel).toBe('high');
    });

    it('get_last_escalated_lead supports custom chatId', async () => {
      const customChatId = '9999999999';
      const customKey = `${LAST_ESCALATION_KEY_PREFIX}${customChatId}`;
      const mockLead = {
        customerPhone: '628111222333',
        customerName: 'Admin Partner',
        productInterest: 'Queen 160',
        escalationReason: 'B2B Inquiry',
        leadSummary: 'Summary B2B',
        urgencyLevel: 'medium',
        escalatedAt: new Date().toISOString(),
      };
      await redis.set(customKey, JSON.stringify(mockLead), 'EX', 3600);

      const tool = getWhatsAppTools().find((t) => t.name === 'get_last_escalated_lead');
      expect(tool).toBeDefined();

      const resJson = await tool!.handler({ chatId: customChatId });
      const parsed = JSON.parse(resJson);
      expect(parsed.found).toBe(true);
      expect(parsed.lead.customerPhone).toBe('628111222333');
    });

    it('get_last_escalated_lead handles corrupted or invalid JSON in Redis', async () => {
      await redis.set(testRedisKey, 'not-valid-json', 'EX', 3600);

      const tool = getWhatsAppTools().find((t) => t.name === 'get_last_escalated_lead');
      expect(tool).toBeDefined();

      const resJson = await tool!.handler({});
      const parsed = JSON.parse(resJson);
      expect(parsed.found).toBe(false);
      expect(parsed.error).toContain('Failed to parse escalation payload');
    });

    it('get_last_escalated_lead handles invalid payload schema in Redis', async () => {
      await redis.set(testRedisKey, JSON.stringify({ invalid: 'schema' }), 'EX', 3600);

      const tool = getWhatsAppTools().find((t) => t.name === 'get_last_escalated_lead');
      expect(tool).toBeDefined();

      const resJson = await tool!.handler({});
      const parsed = JSON.parse(resJson);
      expect(parsed.found).toBe(false);
      expect(parsed.error).toContain('Corrupted escalation payload');
    });

    it('return_to_bot and resume_bot clear both session_mode and session_mute keys in Redis', async () => {
      const testPhone = '082241851577';
      const normalized = '6282241851577';

      // Seed both mode and mute
      await redis.set(`whatsapp:session_mode:${normalized}`, 'HUMAN', 'EX', 1800);
      await redis.set(`whatsapp:session_mute:${normalized}`, 'muted', 'EX', 1800);

      const returnTool = getWhatsAppTools().find((t) => t.name === 'return_to_bot');
      expect(returnTool).toBeDefined();

      const resReturn = await returnTool!.handler({ phone: testPhone });
      expect(JSON.parse(resReturn).success).toBe(true);

      expect(await redis.get(`whatsapp:session_mode:${normalized}`)).toBeNull();
      expect(await redis.get(`whatsapp:session_mute:${normalized}`)).toBeNull();

      // Seed again for resume_bot alias
      await redis.set(`whatsapp:session_mode:${normalized}`, 'HUMAN', 'EX', 1800);
      await redis.set(`whatsapp:session_mute:${normalized}`, 'muted', 'EX', 1800);

      const resumeTool = getWhatsAppTools().find((t) => t.name === 'resume_bot');
      expect(resumeTool).toBeDefined();

      const resResume = await resumeTool!.handler({ phone: testPhone });
      expect(JSON.parse(resResume).success).toBe(true);

      expect(await redis.get(`whatsapp:session_mode:${normalized}`)).toBeNull();
      expect(await redis.get(`whatsapp:session_mute:${normalized}`)).toBeNull();
    });

    describe('rental_order_auto_book_lead Schema & Handler', () => {
      it('validates defaults with companyId filled', () => {
        const parsed = RentalOrderAutoBookLeadArgsSchema.safeParse({});
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.companyId).toBe('04d0ed88-0db8-4641-b98b-101728cd0caa');
        }
      });

      it('accepts valid full payload overrides', () => {
        const parsed = RentalOrderAutoBookLeadArgsSchema.safeParse({
          companyId: '04d0ed88-0db8-4641-b98b-101728cd0caa',
          chatId: '8215203590',
          customerPhone: '082241851577',
          customerName: 'Budi Santoso',
          rentalStartDate: '2026-09-22',
          rentalEndDate: '2026-09-24',
          bundleSize: '160',
          quantity: 2,
          deliveryFee: 15000,
          deliveryAddress: 'Jl. Kaliurang KM 5',
          notes: 'Kasur bersih',
          paymentReference: 'QRIS-DP',
        });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.quantity).toBe(2);
          expect(parsed.data.bundleSize).toBe('160');
          expect(parsed.data.deliveryFee).toBe(15000);
        }
      });

      it('rejects invalid companyId format', () => {
        const parsed = RentalOrderAutoBookLeadArgsSchema.safeParse({
          companyId: 'not-a-uuid',
        });
        expect(parsed.success).toBe(false);
      });

      it('rejects non-positive quantity', () => {
        const parsed = RentalOrderAutoBookLeadArgsSchema.safeParse({
          quantity: 0,
        });
        expect(parsed.success).toBe(false);
      });

      it('rejects negative deliveryFee', () => {
        const parsed = RentalOrderAutoBookLeadArgsSchema.safeParse({
          deliveryFee: -5000,
        });
        expect(parsed.success).toBe(false);
      });

      it('throws descriptive error if customer phone cannot be resolved', async () => {
        const tool = getWhatsAppTools().find((t) => t.name === 'rental_order_auto_book_lead');
        expect(tool).toBeDefined();

        // No escalation in Redis and no phone provided
        await expect(
          tool!.handler({
            companyId: '04d0ed88-0db8-4641-b98b-101728cd0caa',
            chatId: '9999999999', // non-existent chat
          })
        ).rejects.toThrow(/Customer phone could not be resolved/);
      });

      it('throws descriptive error if rental dates cannot be determined', async () => {
        const tool = getWhatsAppTools().find((t) => t.name === 'rental_order_auto_book_lead');
        expect(tool).toBeDefined();

        // Phone provided but no escalation and no dates
        await expect(
          tool!.handler({
            companyId: '04d0ed88-0db8-4641-b98b-101728cd0caa',
            customerPhone: '082241851577',
            chatId: '9999999999',
          })
        ).rejects.toThrow(/Rental dates could not be determined/);
      });
    });
  });
});
