import { describe, it, expect, vi } from 'vitest';
import {
  buildWebhookPayload,
  getWebhookPath,
  OrderCreatedWebhookPayloadSchema,
  PaymentStatusChangedWebhookPayloadSchema,
} from '../../../src/integrations/santi-living/webhooks/payload-builder';
import { santiLivingOrderAdapter } from '../../../src/integrations/santi-living/order-handler';
import { parseComponentLabel } from '../../../src/integrations/santi-living/mappers/component.mapper';
import {
  SyncBundleItemSchema,
  SyncFromSantiLivingInputSchema,
} from '../../../src/integrations/santi-living/sync-handler';
import { santiLivingPlugin } from '../../../src/integrations/santi-living/index';
import type { OrderServicePort } from '../../../src/integrations/types';

describe('Santi Living Integration - Strict Typing & Boundary Contracts', () => {
  describe('Webhook Payload Builder', () => {
    it('transforms valid order.created payload', () => {
      const payload = {
        orderNumber: 'ORD-2026-001',
        customerName: 'Budi Santoso',
        customerPhone: '+6281234567890',
        totalAmount: 1500000,
        token: 'public_token_abc123',
      };

      const result = buildWebhookPayload('order.created', payload, {});
      expect(result).toEqual({
        action: 'new_order',
        orderNumber: 'ORD-2026-001',
        customerName: 'Budi Santoso',
        customerPhone: '+6281234567890',
        totalAmount: 1500000,
      });
    });

    it('falls back and warns on invalid order.created payload', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const invalidPayload = { orderNumber: '' }; // missing required fields

      const result = buildWebhookPayload('order.created', invalidPayload, {});
      expect(result).toEqual(invalidPayload);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('transforms valid payment.status.changed payload', () => {
      const payload = {
        action: 'payment_verified',
        paymentReference: 'REF-9988',
        paymentMethod: 'qris',
        token: 'public_token_abc123',
      };

      const result = buildWebhookPayload('payment.status.changed', payload, {});
      expect(result).toEqual({
        action: 'payment_verified',
        paymentReference: 'REF-9988',
        failReason: undefined,
        paymentMethod: 'qris',
      });
    });

    it('falls back on invalid payment.status.changed payload', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const invalidPayload = { invalidKey: 123 };

      const result = buildWebhookPayload('payment.status.changed', invalidPayload, {});
      expect(result).toEqual(invalidPayload);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('returns raw payload for unknown events', () => {
      const payload = { random: 'data' };
      const result = buildWebhookPayload('unknown.event', payload, {});
      expect(result).toBe(payload);
    });

    it('validates order.created schema directly', () => {
      const valid = {
        orderNumber: 'ORD-2026-001',
        customerName: 'Budi Santoso',
        customerPhone: '+6281234567890',
        totalAmount: 1500000,
        token: 'public_token_abc123',
      };
      expect(OrderCreatedWebhookPayloadSchema.parse(valid)).toMatchObject(valid);
      expect(() => OrderCreatedWebhookPayloadSchema.parse({ orderNumber: '' })).toThrow();
    });

    it('validates payment.status.changed schema directly', () => {
      const valid = {
        action: 'payment_verified',
        token: 'public_token_abc123',
      };
      expect(PaymentStatusChangedWebhookPayloadSchema.parse(valid)).toMatchObject(valid);
      expect(() => PaymentStatusChangedWebhookPayloadSchema.parse({ action: '' })).toThrow();
    });
  });

  describe('Webhook Path Resolver', () => {
    it('resolves default order.created path with token', () => {
      const path = getWebhookPath('order.created', 'tok_123');
      expect(path).toBe('/api/orders/tok_123/notify-admin');
    });

    it('resolves custom order.created path from config', () => {
      const path = getWebhookPath('order.created', 'tok_123', {
        newOrder: '/custom/notify/{token}',
      });
      expect(path).toBe('/custom/notify/tok_123');
    });

    it('resolves default payment.status.changed path with token', () => {
      const path = getWebhookPath('payment.status.changed', 'tok_456');
      expect(path).toBe('/api/orders/tok_456/notify-payment');
    });

    it('resolves fallback for unknown event', () => {
      const path = getWebhookPath('other.event', 'tok_789');
      expect(path).toBe('/api/webhook');
    });
  });

  describe('Component Mapper & Adapter', () => {
    it('parses quantity and label correctly', () => {
      expect(parseComponentLabel('2 bantal tidur')).toEqual({
        quantity: 2,
        label: 'bantal tidur',
      });
      expect(parseComponentLabel('kasur springbed')).toEqual({
        quantity: 1,
        label: 'kasur springbed',
      });
    });

    it('adapter parses string components into items', async () => {
      const fakeOrderService: OrderServicePort = {
        createOrder: vi.fn().mockResolvedValue({ id: 'ord_123' }),
      };

      const input = {
        items: [
          {
            productName: 'Paket Kost Premium',
            quantity: 1,
            pricePerDay: 50000,
            components: ['2 bantal', '1 selimut'],
          },
        ],
        customerName: 'Rina',
        customerPhone: '+628987654321',
      };

      const result = await santiLivingOrderAdapter.createOrder!(
        fakeOrderService,
        input,
        { companyId: 'comp_1' }
      );

      expect(fakeOrderService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          createdBy: 'santi-living-website',
          skuPrefix: 'SL-',
          items: [
            expect.objectContaining({
              components: [
                { quantity: 2, label: 'bantal' },
                { quantity: 1, label: 'selimut' },
              ],
            }),
          ],
        }),
        { companyId: 'comp_1' }
      );
      expect(result).toEqual({ id: 'ord_123' });
    });
  });

  describe('Sync Schemas Validation', () => {
    it('validates a correct bundle item schema', () => {
      const valid = {
        externalId: 'bundle-001',
        name: 'Paket Hemat',
        dailyRate: 25000,
        includes: ['1 bantal', '1 sprei'],
      };
      expect(SyncBundleItemSchema.parse(valid)).toMatchObject(valid);
    });

    it('rejects negative dailyRate', () => {
      const invalid = {
        externalId: 'bundle-001',
        name: 'Paket Hemat',
        dailyRate: -5000,
        includes: [],
      };
      expect(() => SyncBundleItemSchema.parse(invalid)).toThrow();
    });

    it('validates full sync input', () => {
      const input = {
        companyId: 'company-uuid-or-id',
        bundles: [
          {
            externalId: 'bundle-001',
            name: 'Paket',
            dailyRate: 10000,
            includes: [],
          },
        ],
      };
      expect(SyncFromSantiLivingInputSchema.parse(input)).toMatchObject(input);
    });
  });

  describe('Plugin Manifest', () => {
    it('has valid manifest appId and capabilities', () => {
      expect(santiLivingPlugin.manifest.appId).toBe('santi-living');
      expect(santiLivingPlugin.manifest.capabilities).toContain('rental:read');
      expect(santiLivingPlugin.manifest.capabilities).toContain('rental:write');
    });
  });
});
