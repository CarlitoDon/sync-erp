import { describe, it, expect, vi } from 'vitest';
import {
  buildWebhookPayload,
  getWebhookPath,
  OrderCreatedWebhookOutputSchema,
  PaymentStatusChangedWebhookOutputSchema,
  WebhookPathsConfigSchema,
} from '../../../src/integrations/santi-living/webhooks/payload-builder';
import { santiLivingOrderAdapter } from '../../../src/integrations/santi-living/order-handler';
import { parseComponentLabel } from '../../../src/integrations/santi-living/mappers/component.mapper';
import { toExternalSku } from '../../../src/integrations/santi-living/mappers/sku.mapper';
import {
  SyncBundleItemSchema,
  SyncFromSantiLivingInputSchema,
} from '../../../src/integrations/santi-living/sync-handler';
import {
  IntegrationOrderItemSchema,
  IntegrationOrderInputSchema,
} from '../../../src/integrations/types';
import type {
  OrderServicePort,
  IntegrationOrderInput,
} from '../../../src/integrations/types';

describe('Santi Living Integration - Adversarial Stress & Edge Case Tests', () => {
  describe('Webhook Payload Builder Stress Testing', () => {
    const invalidPayloads: unknown[] = [
      null,
      undefined,
      false,
      true,
      0,
      12345,
      '',
      'raw string payload',
      [],
      [1, 2, 3],
      {},
      { orderNumber: '' },
      { orderNumber: 'ORD-1', customerName: '' },
      { orderNumber: 'ORD-1', customerName: 'Alice', customerPhone: '' },
      {
        orderNumber: 'ORD-1',
        customerName: 'Alice',
        customerPhone: '08123',
        totalAmount: -500,
        token: 'tok123',
      },
      {
        orderNumber: 'ORD-1',
        customerName: 'Alice',
        customerPhone: '08123',
        totalAmount: NaN,
        token: 'tok123',
      },
      {
        orderNumber: 'ORD-1',
        customerName: 'Alice',
        customerPhone: '08123',
        totalAmount: 1000,
        token: '',
      },
      {
        action: '',
        token: 'tok123',
      },
      {
        action: 'status_update',
        token: '',
      },
    ];

    it.each(invalidPayloads)(
      'does not crash on malformed order.created payload (%j)',
      (malformed) => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(() => {
          const res = buildWebhookPayload('order.created', malformed, {});
          expect(res).toBe(malformed);
        }).not.toThrow();
        warnSpy.mockRestore();
      }
    );

    it.each(invalidPayloads)(
      'does not crash on malformed payment.status.changed payload (%j)',
      (malformed) => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(() => {
          const res = buildWebhookPayload('payment.status.changed', malformed, {});
          expect(res).toBe(malformed);
        }).not.toThrow();
        warnSpy.mockRestore();
      }
    );

    it('handles unexpected event types gracefully without throwing', () => {
      const weirdEvents = ['', 'unknown', '__proto__', 'undefined', 'null', 'ORDER.CREATED'];
      for (const ev of weirdEvents) {
        const payload = { test: 123 };
        const result = buildWebhookPayload(ev, payload, {});
        expect(result).toBe(payload);
      }
    });

    it('strips private token from order.created output and adheres strictly to output schema', () => {
      const input = {
        orderNumber: 'ORD-999',
        customerName: 'Dewi Lestari',
        customerPhone: '+62811223344',
        totalAmount: 250000,
        token: 'secret_public_token_never_leak_in_body',
        extraSneakyField: 'malicious',
      };

      const result = buildWebhookPayload('order.created', input, {});
      expect(result).toEqual({
        action: 'new_order',
        orderNumber: 'ORD-999',
        customerName: 'Dewi Lestari',
        customerPhone: '+62811223344',
        totalAmount: 250000,
      });
      // Token must not be present in output
      expect(result).not.toHaveProperty('token');
      expect(OrderCreatedWebhookOutputSchema.parse(result)).toBeDefined();
    });

    it('transforms payment.status.changed with various optional field permutations', () => {
      const cases = [
        {
          input: {
            action: 'payment_received',
            token: 'tok-1',
          },
          expected: {
            action: 'payment_received',
            paymentReference: undefined,
            failReason: undefined,
            paymentMethod: undefined,
          },
        },
        {
          input: {
            action: 'payment_failed',
            failReason: 'Card declined by bank',
            paymentMethod: 'credit_card',
            token: 'tok-2',
          },
          expected: {
            action: 'payment_failed',
            paymentReference: undefined,
            failReason: 'Card declined by bank',
            paymentMethod: 'credit_card',
          },
        },
      ];

      for (const c of cases) {
        const res = buildWebhookPayload('payment.status.changed', c.input, {});
        expect(res).toEqual(c.expected);
        expect(PaymentStatusChangedWebhookOutputSchema.parse(res)).toBeDefined();
      }
    });
  });

  describe('Webhook Path Resolver Edge Cases', () => {
    it('handles various pathsConfig inputs safely (null, numbers, malformed)', () => {
      const weirdConfigs = [null, undefined, 123, 'str', [], { unrecognised: true }];
      for (const cfg of weirdConfigs) {
        const p1 = getWebhookPath('order.created', 't1', cfg);
        expect(p1).toBe('/api/orders/t1/notify-admin');

        const p2 = getWebhookPath('payment.status.changed', 't2', cfg);
        expect(p2).toBe('/api/orders/t2/notify-payment');

        const p3 = getWebhookPath('other', 't3', cfg);
        expect(p3).toBe('/api/webhook');
      }
    });

    it('interpolates token properly without regex replacement corruption', () => {
      // Tokens with characters that could confuse regex/string replacement
      const tokens = ['tok_normal', 'tok-with-hyphen', 'tok.with.dots', 'tok_123_abc'];
      for (const t of tokens) {
        const p = getWebhookPath('order.created', t, {
          newOrder: '/v1/orders/{token}/admin-push',
        });
        expect(p).toBe(`/v1/orders/${t}/admin-push`);
      }
    });

    it('validates WebhookPathsConfigSchema accepts custom paths and passthroughs', () => {
      const cfg = {
        newOrder: '/api/custom/order/{token}',
        paymentStatus: '/api/custom/pay/{token}',
        extraProp: 'ok',
      };
      const parsed = WebhookPathsConfigSchema.parse(cfg);
      expect(parsed.newOrder).toBe('/api/custom/order/{token}');
      expect(parsed.paymentStatus).toBe('/api/custom/pay/{token}');
    });
  });

  describe('Component & SKU Mappers Edge Cases', () => {
    it('parses diverse Indonesian component strings', () => {
      expect(parseComponentLabel('1 Kasur Busa')).toEqual({
        quantity: 1,
        label: 'Kasur Busa',
      });
      expect(parseComponentLabel('12 Sprei Katun')).toEqual({
        quantity: 12,
        label: 'Sprei Katun',
      });
      expect(parseComponentLabel('Bantal Guling Standar')).toEqual({
        quantity: 1,
        label: 'Bantal Guling Standar',
      });
      expect(parseComponentLabel('0 Lemari')).toEqual({
        quantity: 0,
        label: 'Lemari',
      });
      expect(parseComponentLabel('')).toEqual({
        quantity: 1,
        label: '',
      });
    });

    it('formats external SKUs consistently', () => {
      expect(toExternalSku('Paket Kost Single')).toBe('SL-paket-kost-single');
      expect(toExternalSku('  Double   Space  \t Tab  ')).toBe('SL--double-space-tab-');
      expect(toExternalSku('Kasur Super 180x200', 'PREFIX-')).toBe('PREFIX-kasur-super-180x200');
    });
  });

  describe('Sync Handler Schemas Stress Testing', () => {
    it('accepts full valid sync payload', () => {
      const valid = {
        companyId: 'comp_test_123',
        bundles: [
          {
            externalId: 'ext_b1',
            name: 'Paket Hemat Lengkap',
            shortName: 'Hemat',
            description: 'Deskripsi paket hemat kost',
            dailyRate: 35000,
            dimensions: '90x200',
            capacity: '1 Person',
            imagePath: '/images/b1.jpg',
            includes: ['1 Kasur', '1 Bantal', '1 Sprei'],
          },
          {
            externalId: 'ext_b2',
            name: 'Paket Zero Rate Promo',
            dailyRate: 0, // Non-negative rate allowed
            includes: [],
          },
        ],
      };

      const parsed = SyncFromSantiLivingInputSchema.parse(valid);
      expect(parsed.companyId).toBe('comp_test_123');
      expect(parsed.bundles).toHaveLength(2);
      expect(parsed.bundles[0].dailyRate).toBe(35000);
      expect(parsed.bundles[1].dailyRate).toBe(0);
    });

    it('rejects invalid bundle schemas strictly', () => {
      // Empty externalId
      expect(() =>
        SyncBundleItemSchema.parse({
          externalId: '',
          name: 'Paket',
          dailyRate: 1000,
          includes: [],
        })
      ).toThrow();

      // Empty name
      expect(() =>
        SyncBundleItemSchema.parse({
          externalId: 'b-1',
          name: '',
          dailyRate: 1000,
          includes: [],
        })
      ).toThrow();

      // Negative dailyRate
      expect(() =>
        SyncBundleItemSchema.parse({
          externalId: 'b-1',
          name: 'Paket',
          dailyRate: -1,
          includes: [],
        })
      ).toThrow();

      // Missing includes
      expect(() =>
        SyncBundleItemSchema.parse({
          externalId: 'b-1',
          name: 'Paket',
          dailyRate: 1000,
        })
      ).toThrow();

      // Includes with non-string elements
      expect(() =>
        SyncBundleItemSchema.parse({
          externalId: 'b-1',
          name: 'Paket',
          dailyRate: 1000,
          includes: [123],
        })
      ).toThrow();
    });

    it('rejects empty companyId in SyncFromSantiLivingInputSchema', () => {
      expect(() =>
        SyncFromSantiLivingInputSchema.parse({
          companyId: '',
          bundles: [],
        })
      ).toThrow();
    });
  });

  describe('Integration Types & Order Adapter Stress Testing', () => {
    it('validates IntegrationOrderItemSchema with different component formats', () => {
      // String components
      const withStrings = IntegrationOrderItemSchema.parse({
        productName: 'Paket A',
        quantity: 2,
        pricePerDay: 20000,
        components: ['1 Bantal', '2 Guling'],
      });
      expect(withStrings.quantity).toBe(2);
      expect(withStrings.components).toEqual(['1 Bantal', '2 Guling']);

      // Object components
      const withObjects = IntegrationOrderItemSchema.parse({
        productName: 'Paket B',
        quantity: 1,
        components: [
          { quantity: 1, label: 'Bantal' },
          { quantity: 2, label: 'Guling' },
        ],
      });
      expect(withObjects.components).toHaveLength(2);

      // Rejects non-positive quantity
      expect(() =>
        IntegrationOrderItemSchema.parse({
          productName: 'Paket C',
          quantity: 0,
        })
      ).toThrow();

      // Rejects negative lineTotal
      expect(() =>
        IntegrationOrderItemSchema.parse({
          productName: 'Paket D',
          lineTotal: -100,
        })
      ).toThrow();
    });

    it('validates IntegrationOrderInputSchema boundary checks', () => {
      // Empty items array is permitted by schema, but items must be valid
      const valid = IntegrationOrderInputSchema.parse({
        items: [],
        customerName: 'Maya',
        customerPhone: '08123456789',
        deliveryFee: 15000,
      });
      expect(valid.customerName).toBe('Maya');
      expect(valid.deliveryFee).toBe(15000);

      // Rejects negative deliveryFee
      expect(() =>
        IntegrationOrderInputSchema.parse({
          items: [],
          deliveryFee: -5000,
        })
      ).toThrow();
    });

    it('adapter transforms string components to objects and forwards metadata correctly', async () => {
      const mockOrderService: OrderServicePort = {
        createOrder: vi.fn().mockImplementation((input, ctx) => {
          return Promise.resolve({ success: true, createdOrderId: 'ord_xyz', input, ctx });
        }),
      };

      const rawInput = {
        items: [
          {
            productName: 'Paket Standar',
            quantity: 1,
            pricePerDay: 40000,
            components: ['2 Bantal', '1 Sprei'],
          },
          {
            productName: 'Tambahan Guling',
            quantity: 2,
            pricePerDay: 10000,
            // No components
          },
          {
            productName: 'Paket Pre-structured',
            quantity: 1,
            components: [{ quantity: 3, label: 'Handuk' }],
          },
        ],
        customerName: 'Joko',
        customerPhone: '08123456789',
        notes: 'Antar sebelum jam 12',
      };

      const context = { companyId: 'company_abc' };

      const response = await santiLivingOrderAdapter.createOrder!(
        mockOrderService,
        rawInput,
        context
      );

      expect(mockOrderService.createOrder).toHaveBeenCalledTimes(1);
      const callArgs = vi.mocked(mockOrderService.createOrder).mock.calls[0];
      const forwardedInput = callArgs[0] as Record<string, unknown>;
      const forwardedCtx = callArgs[1];

      expect(forwardedCtx).toEqual({ companyId: 'company_abc' });
      expect(forwardedInput.createdBy).toBe('santi-living-website');
      expect(forwardedInput.skuPrefix).toBe('SL-');

      const items = forwardedInput.items as Array<Record<string, unknown>>;
      expect(items).toHaveLength(3);

      // First item had string components -> converted to objects
      expect(items[0].components).toEqual([
        { quantity: 2, label: 'Bantal' },
        { quantity: 1, label: 'Sprei' },
      ]);

      // Second item had no components
      expect(items[1].components).toBeUndefined();

      // Third item already had object components -> preserved
      expect(items[2].components).toEqual([{ quantity: 3, label: 'Handuk' }]);

      expect(response).toEqual({
        success: true,
        createdOrderId: 'ord_xyz',
        input: forwardedInput,
        ctx: context,
      });
    });

    it('adapter rejects malformed input at boundary before delegating to orderService', async () => {
      const mockOrderService: OrderServicePort = {
        createOrder: vi.fn(),
      };

      // Invalid input (deliveryFee negative, quantity 0)
      const invalidInput = {
        items: [
          {
            productName: 'Item',
            quantity: 0, // Must be positive
          },
        ],
        deliveryFee: -100, // Must be non-negative
      };

      await expect(
        santiLivingOrderAdapter.createOrder!(
          mockOrderService,
          invalidInput as unknown as IntegrationOrderInput,
          { companyId: 'comp_1' }
        )
      ).rejects.toThrow();

      expect(mockOrderService.createOrder).not.toHaveBeenCalled();
    });
  });
});
