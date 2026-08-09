import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import type { ClientRequest, IncomingMessage } from 'node:http';
import https from 'node:https';
import { describe, expect, it, vi } from 'vitest';
import { RentalWebhookDeliveryType } from '@sync-erp/database';
import {
  isDisallowedIpAddress,
  SafeWebhookTransport,
  WebhookSecurityError,
  WebhookTransportError,
  type PinnedWebhookRequest,
  type WebhookTransportRequest,
  type WebhookTransportResponse,
} from '@src/services/webhook-ssrf-transport';
import { WebhookService } from '@src/services/webhook.service';
import { TenantWebhookOutboxService } from '@src/services/tenant-webhook-outbox.service';
import { WebhookOutboxService } from '@modules/rental/webhook-outbox.service';
import { RentalWebhookOutboxService } from '@modules/rental/rental-webhook-outbox.service';
import { integrationService } from '@src/services/integration.service';

const requestInput = {
  method: 'POST' as const,
  headers: { 'Content-Type': 'application/json' },
  body: '{"event":"test"}',
  timeoutMs: 1_000,
};

const createTransport = (
  resolveHost: (hostname: string) => Promise<readonly string[]>,
  response: WebhookTransportResponse = { statusCode: 204 }
) => {
  const request = vi.fn<
    (request: PinnedWebhookRequest) => Promise<WebhookTransportResponse>
  >();
  request.mockResolvedValue(response);

  return {
    transport: new SafeWebhookTransport({ resolveHost, request }),
    request,
  };
};

const activeWebhookIntegration = {
  id: 'integration-1',
  companyId: 'company-1',
  appId: 'ssrf-transport-test',
  name: 'SSRF transport test',
  isActive: true,
  config: {
    webhookUrl: 'https://partner.example',
    paths: {
      paymentStatus: '/rental/{token}/payment',
    },
  },
  apiKeys: [
    {
      webhookUrl: 'https://partner.example',
      webhookSecret: 'test-webhook-secret',
    },
  ],
};

describe('SafeWebhookTransport', () => {
  it.each([
    'http://127.0.0.1/hook',
    'http://2130706433/hook',
    'http://0x7f000001/hook',
    'http://0177.0.0.1/hook',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/hook',
    'http://[::ffff:127.0.0.1]/hook',
    'http://user:password@example.com/hook',
    'ftp://example.com/hook',
    'http://example.com:22/hook',
  ])('rejects parser tricks and unsafe literal endpoints: %s', async (url) => {
    const resolveHost = vi.fn(async () => ['93.184.216.34']);
    const { transport, request } = createTransport(resolveHost);

    await expect(
      transport.send({ ...requestInput, url })
    ).rejects.toBeInstanceOf(WebhookSecurityError);

    expect(resolveHost).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    'https://example.com:8443/hook',
    'https://example.com:80/hook',
    'http://example.com:8080/hook',
    'http://example.com:443/hook',
  ])('rejects ports outside the protocol-specific allowlist: %s', async (url) => {
    const resolveHost = vi.fn(async () => ['93.184.216.34']);
    const { transport, request } = createTransport(resolveHost);

    await expect(
      transport.send({ ...requestInput, url })
    ).rejects.toBeInstanceOf(WebhookSecurityError);

    expect(resolveHost).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    'https://public.example:443/hook',
    'http://public.example:80/hook',
  ])('allows only the standard port for each supported protocol: %s', async (url) => {
    const resolveHost = vi.fn(async () => ['93.184.216.34']);
    const { transport, request } = createTransport(resolveHost);

    await expect(
      transport.send({ ...requestInput, url })
    ).resolves.toEqual({ statusCode: 204 });

    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each([
    'localhost',
    'service.localhost',
    'service.internal',
    'service.home.arpa',
  ])('rejects local hostname suffix %s before DNS', async (hostname) => {
    const resolveHost = vi.fn(async () => ['93.184.216.34']);
    const { transport, request } = createTransport(resolveHost);

    await expect(
      transport.send({ ...requestInput, url: `https://${hostname}/hook` })
    ).rejects.toBeInstanceOf(WebhookSecurityError);

    expect(resolveHost).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it('rejects DNS answers when any mixed answer is private', async () => {
    const resolveHost = vi.fn(async () => [
      '93.184.216.34',
      '10.0.0.7',
    ]);
    const { transport, request } = createTransport(resolveHost);

    await expect(
      transport.send({ ...requestInput, url: 'https://mixed.example/hook' })
    ).rejects.toBeInstanceOf(WebhookSecurityError);

    expect(resolveHost).toHaveBeenCalledWith('mixed.example');
    expect(request).not.toHaveBeenCalled();
  });

  it('bounds DNS resolution time and never opens a connection after timeout', async () => {
    vi.useFakeTimers();

    try {
      const resolveHost = vi.fn(
        () => new Promise<readonly string[]>(() => undefined)
      );
      const request = vi.fn();
      const transport = new SafeWebhookTransport({
        resolveHost,
        request,
        dnsTimeoutMs: 25,
      });
      const result = expect(
        transport.send({
          ...requestInput,
          url: 'https://slow-dns.example/hook',
        })
      ).rejects.toEqual(
        new WebhookTransportError('Webhook DNS lookup timed out')
      );

      await vi.advanceTimersByTimeAsync(25);
      await result;

      expect(resolveHost).toHaveBeenCalledWith('slow-dns.example');
      expect(request).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps IANA globally reachable 192.175.48.0/24 eligible', () => {
    expect(isDisallowedIpAddress('192.175.48.1')).toBe(false);
  });

  it('rejects oversized request bodies before DNS or connection work', async () => {
    const resolveHost = vi.fn(async () => ['93.184.216.34']);
    const { transport, request } = createTransport(resolveHost);

    await expect(
      transport.send({
        ...requestInput,
        url: 'https://public.example/hook',
        body: 'x'.repeat(1_048_577),
      })
    ).rejects.toBeInstanceOf(WebhookSecurityError);

    expect(resolveHost).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it('caps request and response limits passed to the pinned executor', async () => {
    const resolveHost = vi.fn(async () => ['93.184.216.34']);
    const { transport, request } = createTransport(resolveHost);

    await transport.send({
      ...requestInput,
      url: 'https://public.example/hook',
      timeoutMs: 120_000,
      maxResponseBytes: 2_000_000,
    });

    expect(request.mock.calls[0]?.[0]).toMatchObject({
      timeoutMs: 30_000,
      maxResponseBytes: 65_536,
    });
  });

  it.each([
    ['127.0.0.1', 'loopback DNS answer'],
    ['169.254.169.254', 'link-local DNS answer'],
    ['fd00::1', 'IPv6 unique-local DNS answer'],
    ['::ffff:192.168.1.10', 'IPv4-mapped IPv6 DNS answer'],
  ])('rejects %s returned by DNS (%s)', async (address) => {
    const resolveHost = vi.fn(async () => [address]);
    const { transport, request } = createTransport(resolveHost);

    await expect(
      transport.send({ ...requestInput, url: 'https://dns.example/hook' })
    ).rejects.toBeInstanceOf(WebhookSecurityError);

    expect(request).not.toHaveBeenCalled();
  });

  it('pins a validated public DNS answer at connection time', async () => {
    const resolveHost = vi.fn(async () => ['93.184.216.34']);
    const { transport, request } = createTransport(resolveHost);

    await expect(
      transport.send({ ...requestInput, url: 'https://public.example/hook' })
    ).resolves.toEqual({ statusCode: 204 });

    expect(resolveHost).toHaveBeenCalledWith('public.example');
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]?.[0]).toMatchObject({
      url: 'https://public.example/hook',
      pinnedAddress: '93.184.216.34',
    });
  });

  it('forces TLS certificate verification despite an insecure ambient setting', async () => {
    const previousTlsSetting =
      process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    let capturedOptions: https.RequestOptions | undefined;
    const response = new EventEmitter() as IncomingMessage;
    response.statusCode = 204;
    const requestHandle = new EventEmitter() as ClientRequest;
    requestHandle.setTimeout = vi.fn(() => requestHandle) as never;
    requestHandle.write = vi.fn(() => true) as never;
    requestHandle.destroy = vi.fn(() => requestHandle) as never;

    const requestSpy = vi.spyOn(https, 'request');
    requestSpy.mockImplementation((
      (
        options: https.RequestOptions,
        callback: (incoming: IncomingMessage) => void
      ) => {
        capturedOptions = options;
        requestHandle.end = vi.fn(() => {
          queueMicrotask(() => {
            callback(response);
            queueMicrotask(() => response.emit('end'));
          });
          return requestHandle;
        }) as never;
        return requestHandle;
      }
    ) as never);

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    try {
      const transport = new SafeWebhookTransport({
        resolveHost: async () => ['93.184.216.34'],
      });

      await expect(
        transport.send({
          ...requestInput,
          url: 'https://public.example/hook',
        })
      ).resolves.toEqual({ statusCode: 204 });

      expect(capturedOptions).toMatchObject({
        rejectUnauthorized: true,
        servername: 'public.example',
      });
    } finally {
      requestSpy.mockRestore();
      if (previousTlsSetting === undefined) {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      } else {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = previousTlsSetting;
      }
    }

    expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe(
      previousTlsSetting
    );
  });

  it('fails closed on redirects without following the target', async () => {
    const resolveHost = vi.fn(async () => ['93.184.216.34']);
    const { transport, request } = createTransport(resolveHost, {
      statusCode: 302,
    });

    await expect(
      transport.send({ ...requestInput, url: 'https://public.example/hook' })
    ).rejects.toMatchObject({
      code: 'WEBHOOK_SECURITY_POLICY',
      message: 'Webhook redirects are disabled',
    });

    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe('shared webhook transport integration', () => {
  it('uses the same injectable SSRF-safe transport for test and queued delivery', async () => {
    const send = vi.fn<
      (request: WebhookTransportRequest) => Promise<WebhookTransportResponse>
    >();
    send.mockResolvedValue({ statusCode: 204 });
    const transport = { send };

    const testService = new WebhookService(transport);
    const outboxService = new TenantWebhookOutboxService(transport);

    const testResult = await testService.testWebhook(
      'https://public.example/hook',
      'test-secret'
    );
    const deliveryResult = await (
      outboxService as unknown as {
        performFetch: (entry: {
          id: string;
          event: string;
          payload: Record<string, unknown>;
          webhookUrl: string;
          webhookSecret: string | null;
          eventTimestamp: Date;
        }) => Promise<unknown>;
      }
    ).performFetch({
      id: 'delivery-1',
      event: 'order.created',
      payload: { orderId: 'order-1' },
      webhookUrl: 'https://public.example/hook',
      webhookSecret: 'test-secret',
      eventTimestamp: new Date('2026-08-09T00:00:00.000Z'),
    });

    expect(testResult.success).toBe(true);
    expect(deliveryResult).toMatchObject({
      success: true,
      statusCode: 204,
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      url: 'https://public.example/hook',
      method: 'POST',
    });
    expect(send.mock.calls[1]?.[0]).toMatchObject({
      url: 'https://public.example/hook',
      method: 'POST',
    });
  });

  it('returns a non-sensitive permanent failure for blocked production targets', async () => {
    const transport = new SafeWebhookTransport({
      resolveHost: async () => ['10.0.0.8'],
      request: vi.fn(),
    });
    const testService = new WebhookService(transport);
    const outboxService = new TenantWebhookOutboxService(transport);

    const testResult = await testService.testWebhook(
      'https://rebound.example/hook',
      'test-secret'
    );
    const deliveryResult = await (
      outboxService as unknown as {
        performFetch: (entry: {
          id: string;
          event: string;
          payload: Record<string, unknown>;
          webhookUrl: string;
          webhookSecret: string | null;
          eventTimestamp: Date;
        }) => Promise<{ permanent: boolean; error?: string }>;
      }
    ).performFetch({
      id: 'delivery-2',
      event: 'order.created',
      payload: { secret: 'must-not-escape' },
      webhookUrl: 'https://rebound.example/hook',
      webhookSecret: 'test-secret',
      eventTimestamp: new Date(),
    });

    expect(testResult).toMatchObject({
      success: false,
      error: 'Webhook endpoint rejected by security policy',
    });
    expect(deliveryResult).toEqual({
      success: false,
      permanent: true,
      error: 'Webhook endpoint rejected by security policy',
      duration: expect.any(Number),
    });
    expect(testResult.error).not.toContain('must-not-escape');
    expect(deliveryResult.error).not.toContain('must-not-escape');
  });

  it('routes both rental production outboxes through the shared transport', async () => {
    const send = vi.fn<
      (request: WebhookTransportRequest) => Promise<WebhookTransportResponse>
    >();
    send.mockResolvedValue({ statusCode: 202 });
    const integrationSpy = vi
      .spyOn(integrationService, 'getActiveIntegrationForCompany')
      .mockResolvedValue(activeWebhookIntegration as never);

    try {
      const genericOutbox = new WebhookOutboxService({ send });
      const rentalOutbox = new RentalWebhookOutboxService({ send });

      const genericResult = await (
        genericOutbox as unknown as {
          performFetch: (entry: {
            id: string;
            deliveryType: RentalWebhookDeliveryType;
            orderPublicToken: string;
            orderNumber: string | null;
            payload: Record<string, unknown>;
            companyId: string;
          }) => Promise<unknown>;
        }
      ).performFetch({
        id: 'rental-delivery-1',
        deliveryType: RentalWebhookDeliveryType.PAYMENT_STATUS,
        orderPublicToken: 'token-1',
        orderNumber: 'RNT-1',
        payload: { action: 'confirmed' },
        companyId: 'company-1',
      });
      const rentalResult = await (
        rentalOutbox as unknown as {
          performFetch: (entry: {
            id: string;
            companyId: string;
            deliveryType: RentalWebhookDeliveryType;
            orderPublicToken: string;
            orderNumber: string | null;
            payload: Record<string, unknown>;
          }) => Promise<unknown>;
        }
      ).performFetch({
        id: 'rental-delivery-2',
        companyId: 'company-1',
        deliveryType: RentalWebhookDeliveryType.PAYMENT_STATUS,
        orderPublicToken: 'token-2',
        orderNumber: 'RNT-2',
        payload: {
          action: 'confirmed',
          paymentMethod: 'qris',
          paymentReference: 'reference-2',
        },
      });

      expect(genericResult).toMatchObject({
        success: true,
        statusCode: 202,
      });
      expect(rentalResult).toMatchObject({
        success: true,
        statusCode: 202,
      });
      expect(send).toHaveBeenCalledTimes(2);
      expect(send.mock.calls[0]?.[0]).toMatchObject({
        url: 'https://partner.example/api/webhook',
        method: 'POST',
        headers: {
          Authorization: 'test-webhook-secret',
          'X-Webhook-Delivery-Id': 'rental-delivery-1',
          'Idempotency-Key': 'rental-delivery-1',
        },
      });
      expect(send.mock.calls[1]?.[0]).toMatchObject({
        url: 'https://partner.example/rental/token-2/payment',
        method: 'POST',
        headers: {
          Authorization: 'test-webhook-secret',
          'X-Webhook-Delivery-Id': 'rental-delivery-2',
          'Idempotency-Key': 'rental-delivery-2',
        },
      });
      expect(JSON.parse(send.mock.calls[0]?.[0].body ?? '{}')).toEqual({
        action: 'confirmed',
      });
      expect(JSON.parse(send.mock.calls[1]?.[0].body ?? '{}')).toEqual({
        action: 'confirmed',
        paymentReference: 'reference-2',
        paymentMethod: 'qris',
      });
    } finally {
      integrationSpy.mockRestore();
    }
  });

  it('preserves rental retry classification without exposing target bodies', async () => {
    const send = vi.fn<
      (request: WebhookTransportRequest) => Promise<WebhookTransportResponse>
    >();
    send
      .mockResolvedValueOnce({ statusCode: 503 })
      .mockResolvedValueOnce({ statusCode: 400 });
    const integrationSpy = vi
      .spyOn(integrationService, 'getActiveIntegrationForCompany')
      .mockResolvedValue(activeWebhookIntegration as never);

    try {
      const genericOutbox = new WebhookOutboxService({ send });
      const rentalOutbox = new RentalWebhookOutboxService({ send });
      const genericResult = await (
        genericOutbox as unknown as {
          performFetch: (entry: Record<string, unknown>) => Promise<unknown>;
        }
      ).performFetch({
        id: 'retry-delivery-1',
        deliveryType: RentalWebhookDeliveryType.PAYMENT_STATUS,
        orderPublicToken: 'retry-token-1',
        orderNumber: 'RNT-RETRY-1',
        payload: { action: 'confirmed' },
        companyId: 'company-1',
      });
      const rentalResult = await (
        rentalOutbox as unknown as {
          performFetch: (entry: Record<string, unknown>) => Promise<unknown>;
        }
      ).performFetch({
        id: 'retry-delivery-2',
        companyId: 'company-1',
        deliveryType: RentalWebhookDeliveryType.PAYMENT_STATUS,
        orderPublicToken: 'retry-token-2',
        orderNumber: 'RNT-RETRY-2',
        payload: { action: 'confirmed' },
      });

      expect(genericResult).toEqual({
        success: false,
        permanent: false,
        statusCode: 503,
        error: 'Webhook failed: 503',
      });
      expect(rentalResult).toEqual({
        success: false,
        permanent: true,
        statusCode: 400,
        error: 'Webhook failed: 400',
      });
    } finally {
      integrationSpy.mockRestore();
    }
  });

  it('makes SSRF policy failures permanent and redacted in both rental outboxes', async () => {
    const send = vi.fn<
      (request: WebhookTransportRequest) => Promise<WebhookTransportResponse>
    >();
    send.mockRejectedValue(new WebhookSecurityError());
    const integrationSpy = vi
      .spyOn(integrationService, 'getActiveIntegrationForCompany')
      .mockResolvedValue(activeWebhookIntegration as never);

    try {
      const genericOutbox = new WebhookOutboxService({ send });
      const rentalOutbox = new RentalWebhookOutboxService({ send });
      const genericResult = await (
        genericOutbox as unknown as {
          performFetch: (entry: Record<string, unknown>) => Promise<unknown>;
        }
      ).performFetch({
        id: 'blocked-delivery-1',
        deliveryType: RentalWebhookDeliveryType.PAYMENT_STATUS,
        orderPublicToken: 'blocked-token-1',
        orderNumber: 'RNT-BLOCKED-1',
        payload: { privateValue: 'must-not-escape' },
        companyId: 'company-1',
      });
      const rentalResult = await (
        rentalOutbox as unknown as {
          performFetch: (entry: Record<string, unknown>) => Promise<unknown>;
        }
      ).performFetch({
        id: 'blocked-delivery-2',
        companyId: 'company-1',
        deliveryType: RentalWebhookDeliveryType.PAYMENT_STATUS,
        orderPublicToken: 'blocked-token-2',
        orderNumber: 'RNT-BLOCKED-2',
        payload: {
          action: 'confirmed',
          privateValue: 'must-not-escape',
        },
      });

      expect(genericResult).toEqual({
        success: false,
        permanent: true,
        error: 'Webhook endpoint rejected by security policy',
      });
      expect(rentalResult).toEqual({
        success: false,
        permanent: true,
        error: 'Webhook endpoint rejected by security policy',
      });
      expect(JSON.stringify([genericResult, rentalResult])).not.toContain(
        'must-not-escape'
      );
    } finally {
      integrationSpy.mockRestore();
    }
  });
});

describe('webhook callsite regression', () => {
  it('keeps every user-configured webhook path off direct fetch', () => {
    const sourcePaths = [
      '../../src/services/webhook.service.ts',
      '../../src/services/tenant-webhook-outbox.service.ts',
      '../../src/modules/rental/webhook-outbox.service.ts',
      '../../src/modules/rental/rental-webhook-outbox.service.ts',
      '../../src/modules/rental/rental-webhook.service.ts',
    ];
    const sources = sourcePaths.map((path) =>
      readFileSync(new URL(path, import.meta.url), 'utf8')
    );

    for (const source of sources) {
      expect(source).not.toMatch(/\bfetch\s*\(/);
    }

    for (const source of sources.slice(0, 4)) {
      expect(source).toContain('defaultWebhookTransport');
      expect(source).toContain('transport.send');
    }

    expect(sources[4]).toContain(
      'rentalWebhookOutboxService.enqueuePaymentStatus'
    );
    expect(sources[4]).toContain(
      'rentalWebhookOutboxService.enqueueNewOrder'
    );
  });
});
