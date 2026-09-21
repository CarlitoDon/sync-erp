import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizePhone,
  calculateDeliveryFee,
  buildLeadCard,
  EscalateArgsSchema,
  getWhatsAppTools,
} from './whatsapp.js';
import { getWhatsAppConfig } from '../config.js';

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
    it('formats structured lead card for Telegram notification', () => {
      const card = buildLeadCard({
        customerName: 'Budi Santoso',
        customerPhone: '081234567890',
        productInterest: 'Kasur Busa 160x200 + Bantal',
        escalationReason: 'Minta diskon 20% karena sewa 6 bulan',
        leadSummary: 'Customer butuh kasur untuk kos, minta potongan harga.',
        urgencyLevel: 'high',
      });

      expect(card).toContain('🚨 ESKALASI LEAD MASUK');
      expect(card).toContain('👤 Nama: Budi Santoso');
      expect(card).toContain('📱 WA: 081234567890');
      expect(card).toContain('🎯 Minat: Kasur Busa 160x200 + Bantal');
      expect(card).toContain('⏱️ Urgensi: 🟠 HIGH');
      expect(card).toContain('Minta diskon 20% karena sewa 6 bulan');
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
    it('registers all 7 WhatsApp tools with correct names and schemas', () => {
      const tools = getWhatsAppTools();
      expect(tools.length).toBe(7);

      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toEqual([
        'whatsapp_send_message',
        'estimate_delivery_fee',
        'set_customer_note',
        'escalate_to_owner',
        'manage_customer_whitelist',
        'take_over_conversation',
        'return_to_bot',
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

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('loads defaults when optional env vars are omitted', () => {
      delete process.env.WHATSAPP_BOT_URL;
      delete process.env.WHATSAPP_BOT_SECRET;
      delete process.env.GOOGLE_MAPS_API_KEY;
      delete process.env.REDIS_URL;
      delete process.env.CARLA_TELEGRAM_BOT_TOKEN;

      const config = getWhatsAppConfig();
      expect(config.botUrl).toBe('http://127.0.0.1:3060');
      expect(config.redisUrl).toBe('redis://127.0.0.1:6379');
      expect(config.botSecret).toBe('');
    });
  });
});
