import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { createServer as createNetServer } from 'net';
import { existsSync } from 'fs';
import crypto from 'crypto';
import path from 'path';
import express from 'express';
import * as trpcExpress from '@trpc/server/adapters/express';
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { z } from 'zod';
import { fileURLToPath, pathToFileURL } from 'url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@sync-erp/database';
import { apiKeyService } from '@src/services/api-key.service';

const COMPANY_ID = 'test-santi-living-live-e2e-001';
const PROXY_API_SECRET = 'proxy-live-e2e-secret';
const BOT_SECRET = 'bot-live-e2e-secret';
const rejectedTransactionStatuses = ['expire', 'cancel', 'deny'] as const;

const botState = {
  adminMessages: [] as Array<{ phone: string; message: string }>,
  orderNotifications: [] as Array<{
    orderId: string;
    customerName: string;
    customerWhatsapp: string;
    totalPrice: number;
    orderUrl?: string;
  }>,
  invalidPhones: new Set<string>(),
};

type ProxyClient = {
  order: {
    create: {
      mutate: (input: Record<string, unknown>) => Promise<{
        id: string;
        orderNumber: string;
        publicToken: string;
        status: string;
        createdAt: string;
        orderUrl: string;
      }>;
    };
    confirmPayment: {
      mutate: (input: {
        token: string;
        paymentMethod: 'qris' | 'transfer' | 'gopay';
        reference?: string;
      }) => Promise<{
        success: boolean;
        orderNumber: string;
        rentalPaymentStatus: string;
        paymentClaimedAt: Date | string | null;
      }>;
    };
  };
};

type HttpApp = {
  listen: (
    port: number,
    hostname: string,
    listeningListener: () => void
  ) => Server;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const codingRoot = path.resolve(__dirname, '../../../../../');
const proxyServerModulePath = path.resolve(
  codingRoot,
  'santi-living/apps/proxy/src/server.ts'
);
const proxyClientModulePath = path.resolve(
  codingRoot,
  'santi-living/apps/web/src/lib/trpc-client.ts'
);
const hasSantiLivingWorkspace =
  existsSync(proxyServerModulePath) && existsSync(proxyClientModulePath);
const shouldRunLiveCrossRepoE2E =
  process.env.RUN_SANTI_LIVING_LIVE_E2E === 'true';
const proxyServerModuleUrl = pathToFileURL(
  proxyServerModulePath
).href;
const proxyClientModuleUrl = pathToFileURL(
  proxyClientModulePath
).href;

const createBotStubApp = () => {
  const t = initTRPC.create({
    transformer: superjson,
  });

  const botRouter = t.router({
    bot: t.router({
      sendMessage: t.procedure
        .input(
          z.object({
            phone: z.string(),
            message: z.string(),
          })
        )
        .mutation(({ input }) => {
          botState.adminMessages.push(input);
          return {
            success: true,
            messageId: `msg-${botState.adminMessages.length}`,
          };
        }),
      sendOrder: t.procedure
        .input(
          z.object({
            orderId: z.string(),
            customerName: z.string(),
            customerWhatsapp: z.string(),
            deliveryAddress: z.string(),
            items: z.array(
              z.object({
                name: z.string(),
                category: z.enum(['package', 'mattress', 'accessory']),
                quantity: z.number(),
                pricePerDay: z.number(),
              })
            ),
            totalPrice: z.number(),
            orderDate: z.string(),
            endDate: z.string(),
            duration: z.number(),
            deliveryFee: z.number(),
            paymentMethod: z.enum(['qris', 'transfer', 'gopay']).optional(),
            addressFields: z
              .object({
                street: z.string().optional(),
                kecamatan: z.string().optional(),
                kota: z.string().optional(),
                lat: z.string().optional(),
                lng: z.string().optional(),
              })
              .optional(),
            orderUrl: z.string().optional(),
          })
        )
        .mutation(({ input }) => {
          const normalizedPhone = input.customerWhatsapp.replace(
            /^0/,
            '62'
          );

          if (
            botState.invalidPhones.has(input.customerWhatsapp) ||
            botState.invalidPhones.has(normalizedPhone)
          ) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Invalid WhatsApp Number',
            });
          }

          botState.orderNotifications.push({
            orderId: input.orderId,
            customerName: input.customerName,
            customerWhatsapp: input.customerWhatsapp,
            totalPrice: input.totalPrice,
            orderUrl: input.orderUrl,
          });

          return {
            success: true,
            messageId: `order-${botState.orderNotifications.length}`,
          };
        }),
    }),
  });

  const app = express();
  app.use(express.json());
  app.use('/api/trpc', (req, res, next) => {
    if (req.headers.authorization !== `Bearer ${BOT_SECRET}`) {
      res.status(401).json({ message: 'Unauthorized bot request' });
      return;
    }

    next();
  });
  app.use(
    '/api/trpc',
    trpcExpress.createExpressMiddleware({
      router: botRouter,
      createContext: () => ({}),
    })
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
};

const findFreePort = async () => {
  return await new Promise<number>((resolve, reject) => {
    const server = createNetServer();

    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      const { port } = address;

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });

    server.once('error', reject);
  });
};

const listen = async (app: HttpApp, port: number) => {
  return await new Promise<{
    server: Server;
    port: number;
    url: string;
  }>((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      resolve({
        server,
        port: address.port,
        url: `http://127.0.0.1:${address.port}`,
      });
    });

    server.once('error', reject);
  });
};

const closeServer = async (server?: Server) => {
  if (!server) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

const waitFor = async (
  predicate: () => boolean | Promise<boolean>,
  options: {
    timeoutMs?: number;
    intervalMs?: number;
    description?: string;
  } = {}
) => {
  const timeoutMs = options.timeoutMs ?? 5000;
  const intervalMs = options.intervalMs ?? 50;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    options.description ?? 'Condition was not met before timeout'
  );
};

const createMidtransSignature = (
  orderId: string,
  statusCode: string,
  grossAmount: string
) => {
  const serverKey = process.env.MIDTRANS_SERVER_KEY || '';

  return crypto
    .createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest('hex');
};

const postMidtransWebhook = async (input: {
  orderId: string;
  transactionStatus: string;
  paymentType?: string;
  transactionId?: string;
  fraudStatus?: string;
  grossAmount?: string;
  statusCode?: string;
  signatureKey?: string;
}) => {
  const grossAmount = input.grossAmount ?? '165000.00';
  const statusCode = input.statusCode ?? '200';
  const signatureKey =
    input.signatureKey ??
    createMidtransSignature(input.orderId, statusCode, grossAmount);

  return await fetch(`${process.env.SANTI_PROXY_URL}/api/webhooks/midtrans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      order_id: input.orderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signatureKey,
      transaction_status: input.transactionStatus,
      payment_type: input.paymentType,
      transaction_id: input.transactionId,
      fraud_status: input.fraudStatus,
    }),
  });
};

const createWebsiteOrder = async (client: ProxyClient) => {
  return client.order.create.mutate({
    customerName: 'Budi Santoso',
    customerWhatsapp: '081234567890',
    deliveryAddress: 'Jl. Malioboro No. 1, Yogyakarta',
    addressFields: {
      street: 'Jl. Malioboro No. 1',
      kelurahan: 'Sosromenduran',
      kecamatan: 'Gedong Tengen',
      kota: 'Yogyakarta',
      provinsi: 'DIY',
      zip: '55271',
      lat: '-7.7928',
      lng: '110.3658',
    },
    items: [
      {
        id: 'package-single-standard',
        name: 'Single Standard (Paket)',
        category: 'package' as const,
        quantity: 1,
        pricePerDay: 35000,
        includes: ['kasur busa 90x200', 'sprei 90x200', 'bantal', 'selimut'],
      },
      {
        id: 'mattress-double',
        name: 'Double (Kasur)',
        category: 'mattress' as const,
        quantity: 1,
        pricePerDay: 45000,
        includes: ['kasur busa 120x200'],
      },
    ],
    totalPrice: 165000,
    orderDate: '2026-03-20T00:00:00.000Z',
    endDate: '2026-03-22T00:00:00.000Z',
    duration: 2,
    deliveryFee: 15000,
    paymentMethod: 'qris' as const,
    notes: 'Tolong antar pagi hari',
    volumeDiscountAmount: 10000,
    volumeDiscountLabel: 'Promo Maret',
  });
};

const cleanupCompanyOrders = async () => {
  await prisma.$transaction([
    prisma.rentalWebhookOutbox.deleteMany({
      where: { companyId: COMPANY_ID },
    }),
    prisma.rentalBundleComponent.deleteMany({
      where: { bundle: { companyId: COMPANY_ID } },
    }),
    prisma.rentalOrderItem.deleteMany({
      where: { rentalOrder: { companyId: COMPANY_ID } },
    }),
    prisma.rentalOrder.deleteMany({
      where: { companyId: COMPANY_ID },
    }),
    prisma.rentalBundle.deleteMany({
      where: { companyId: COMPANY_ID },
    }),
    prisma.rentalItem.deleteMany({
      where: { companyId: COMPANY_ID },
    }),
    prisma.documentSequence.deleteMany({
      where: { companyId: COMPANY_ID },
    }),
    prisma.product.deleteMany({
      where: { companyId: COMPANY_ID },
    }),
    prisma.partner.deleteMany({
      where: { companyId: COMPANY_ID },
    }),
  ]);
};

describe.skipIf(
  !hasSantiLivingWorkspace || !shouldRunLiveCrossRepoE2E
)(
  'Santi Living live order flow E2E',
  () => {
  let botServer: Server;
  let erpServer: Server;
  let proxyServer: Server;
  let proxyClient: ProxyClient;

  beforeAll(async () => {
    const [botPort, erpPort, proxyPort] = await Promise.all([
      findFreePort(),
      findFreePort(),
      findFreePort(),
    ]);

    process.env.NODE_ENV = 'test';
    process.env.PROXY_API_SECRET = PROXY_API_SECRET;
    process.env.PROXY_API_KEY = '';
    process.env.SANTI_LIVING_COMPANY_ID = COMPANY_ID;
    process.env.PUBLIC_BASE_URL = 'https://santi.test';
    process.env.SYNC_ERP_BOT_SECRET = BOT_SECRET;
    process.env.ADMIN_WHATSAPP_NUMBER = '62800000000000';
    process.env.MIDTRANS_SERVER_KEY = 'test-midtrans-server-key';
    process.env.MIDTRANS_CLIENT_KEY = 'test-midtrans-client-key';
    process.env.SYNC_ERP_BOT_URL = `http://127.0.0.1:${botPort}`;
    process.env.SYNC_ERP_API_URL = `http://127.0.0.1:${erpPort}/api/trpc`;
    process.env.SANTI_LIVING_WEBHOOK_URL = `http://127.0.0.1:${proxyPort}`;
    process.env.SANTI_LIVING_WEBHOOK_API_KEY = PROXY_API_SECRET;
    process.env.SANTI_PROXY_URL = `http://127.0.0.1:${proxyPort}`;
    process.env.PUBLIC_PROXY_URL = `http://127.0.0.1:${proxyPort}`;

    await cleanupCompanyOrders();
    await prisma.apiKey.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: {
        id: COMPANY_ID,
        name: 'Santi Living Live E2E',
      },
      update: {
        name: 'Santi Living Live E2E',
      },
    });

    const botApp = createBotStubApp();
    const botListener = await listen(botApp, botPort);
    botServer = botListener.server;

    const apiKey = await apiKeyService.createKey(COMPANY_ID, 'Proxy Live E2E', {
      permissions: ['rental:read', 'rental:write'],
    });
    process.env.SYNC_ERP_API_SECRET = apiKey.key;

    const { createApp } = await import('@src/app');
    const erpApp = createApp();
    const erpListener = await listen(erpApp, erpPort);
    erpServer = erpListener.server;

    const { createServer: createProxyServer } = await import(
      proxyServerModuleUrl
    );
    const proxyApp = createProxyServer();
    const proxyListener = await listen(proxyApp, proxyPort);
    proxyServer = proxyListener.server;

    const { createProxyClient } = await import(
      proxyClientModuleUrl
    );
    proxyClient = createProxyClient() as unknown as ProxyClient;
  });

  beforeEach(async () => {
    botState.adminMessages = [];
    botState.orderNotifications = [];
    botState.invalidPhones.clear();
    await cleanupCompanyOrders();
  });

  afterAll(async () => {
    await cleanupCompanyOrders();
    await prisma.apiKey.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.company.deleteMany({
      where: { id: COMPANY_ID },
    });

    await closeServer(proxyServer);
    await closeServer(erpServer);
    await closeServer(botServer);
  });

  it('creates an order across live proxy and ERP services, then sends admin and customer notifications', async () => {
    const result = await createWebsiteOrder(proxyClient);

    expect(result.orderNumber).toMatch(/^RNT-\d{6}-\d{5}$/);
    expect(result.status).toBe('DRAFT');

    const order = await prisma.rentalOrder.findUnique({
      where: { id: result.id },
      include: {
        items: true,
        partner: true,
      },
    });

    expect(order).toBeTruthy();
    expect(order?.companyId).toBe(COMPANY_ID);
    expect(order?.items).toHaveLength(2);
    expect(order?.partner?.name).toBe('Budi Santoso');
    expect(order?.publicToken).toBe(result.publicToken);

    expect(botState.adminMessages).toHaveLength(1);
    expect(botState.adminMessages[0]?.phone).toBe('62800000000000');
    expect(botState.adminMessages[0]?.message).toContain(result.orderNumber);

    expect(botState.orderNotifications).toHaveLength(1);
    expect(botState.orderNotifications[0]).toMatchObject({
      orderId: result.orderNumber,
      customerName: 'Budi Santoso',
      customerWhatsapp: '6281234567890',
      totalPrice: 165000,
      orderUrl: `https://santi-living.com/sewa-kasur/pesanan/${result.publicToken}`,
    });
  });

  it('claims payment and completes the live payment lifecycle through Midtrans webhook confirmation', async () => {
    const created = await createWebsiteOrder(proxyClient);

    botState.adminMessages = [];
    botState.orderNotifications = [];

    const claimed = await proxyClient.order.confirmPayment.mutate({
      token: created.publicToken,
      paymentMethod: 'transfer',
      reference: 'TRF-LIVE-001',
    });

    expect(claimed.success).toBe(true);
    expect(claimed.rentalPaymentStatus).toBe('AWAITING_CONFIRM');

    const claimedOrder = await prisma.rentalOrder.findUnique({
      where: { id: created.id },
    });
    expect(claimedOrder?.rentalPaymentStatus).toBe('AWAITING_CONFIRM');
    expect(claimedOrder?.paymentClaimedAt).toBeTruthy();
    expect(claimedOrder?.paymentMethod).toBe('transfer');
    expect(claimedOrder?.paymentReference).toBe('TRF-LIVE-001');
    expect(claimedOrder?.status).toBe('DRAFT');

    await waitFor(
      () => botState.adminMessages.length >= 2,
      {
        description: 'Payment claim notifications to admin and customer',
      }
    );

    const claimMessages = botState.adminMessages.map((entry) => entry.message);
    expect(claimMessages.some((message) => message.includes('KONFIRMASI PEMBAYARAN BARU'))).toBe(true);
    expect(claimMessages.some((message) => message.includes('Konfirmasi Pembayaran Diterima'))).toBe(true);
    expect(botState.adminMessages.map((entry) => entry.phone)).toEqual(
      expect.arrayContaining(['62800000000000', '6281234567890'])
    );

    const midtransOrderId = `${created.orderNumber}-${Math.floor(Date.now() / 1000)}`;
    const statusCode = '200';
    const grossAmount = '165000.00';
    const transactionId = 'midtrans-live-trx-001';
    const signatureKey = createMidtransSignature(
      midtransOrderId,
      statusCode,
      grossAmount
    );

    const response = await postMidtransWebhook({
      orderId: midtransOrderId,
      statusCode,
      grossAmount,
      transactionStatus: 'settlement',
      paymentType: 'transfer',
      transactionId,
      signatureKey,
    });

    expect(response.status).toBe(200);

    await waitFor(async () => {
      const order = await prisma.rentalOrder.findUnique({
        where: { id: created.id },
      });

      return (
        order?.rentalPaymentStatus === 'CONFIRMED' &&
        order.status === 'CONFIRMED'
      );
    }, {
      description: 'ERP order confirmation after Midtrans webhook',
    });

    const confirmedOrder = await prisma.rentalOrder.findUnique({
      where: { id: created.id },
    });
    expect(confirmedOrder?.rentalPaymentStatus).toBe('CONFIRMED');
    expect(confirmedOrder?.status).toBe('CONFIRMED');
    expect(confirmedOrder?.paymentConfirmedAt).toBeTruthy();
    expect(confirmedOrder?.paymentReference).toBe(transactionId);

    await waitFor(
      () => botState.adminMessages.length >= 4,
      {
        description: 'Payment confirmed notifications to admin and customer',
      }
    );

    const allMessages = botState.adminMessages.map((entry) => entry.message);
    expect(allMessages.some((message) => message.includes('PEMBAYARAN DITERIMA'))).toBe(true);
    expect(allMessages.some((message) => message.includes('Pembayaran Berhasil!'))).toBe(true);
    expect(botState.adminMessages.map((entry) => entry.phone)).toEqual(
      expect.arrayContaining(['62800000000000', '6281234567890'])
    );
  });

  it.each(rejectedTransactionStatuses)(
    'marks the ERP payment as FAILED and sends rejected notifications when Midtrans returns %s',
    async (transactionStatus) => {
      const created = await createWebsiteOrder(proxyClient);

      botState.adminMessages = [];
      botState.orderNotifications = [];

      const response = await postMidtransWebhook({
        orderId: `${created.orderNumber}-${Math.floor(Date.now() / 1000)}`,
        transactionStatus,
        paymentType: 'qris',
      });

      expect(response.status).toBe(200);

      await waitFor(async () => {
        const order = await prisma.rentalOrder.findUnique({
          where: { id: created.id },
        });

        return order?.rentalPaymentStatus === 'FAILED';
      }, {
        description: `ERP order payment failure after Midtrans ${transactionStatus} webhook`,
      });

      const failedOrder = await prisma.rentalOrder.findUnique({
        where: { id: created.id },
      });
      expect(failedOrder?.rentalPaymentStatus).toBe('FAILED');
      expect(failedOrder?.status).toBe('DRAFT');
      expect(failedOrder?.paymentFailedAt).toBeTruthy();
      expect(failedOrder?.paymentFailReason).toBe(
        `Midtrans transaction ${transactionStatus}`
      );

      await waitFor(
        () => botState.adminMessages.length >= 2,
        {
          description: `Payment rejected notifications for ${transactionStatus}`,
        }
      );

      const rejectedMessages = botState.adminMessages.map(
        (entry) => entry.message
      );
      expect(
        rejectedMessages.some((message) =>
          message.includes('PEMBAYARAN GAGAL / KADALUWARSA')
        )
      ).toBe(true);
      expect(
        rejectedMessages.some((message) =>
          message.includes('Pembayaran Belum Berhasil')
        )
      ).toBe(true);
      expect(botState.adminMessages.map((entry) => entry.phone)).toEqual(
        expect.arrayContaining(['62800000000000', '6281234567890'])
      );
    }
  );

  it('rejects invalid Midtrans signatures without mutating ERP payment state', async () => {
    const created = await createWebsiteOrder(proxyClient);

    botState.adminMessages = [];
    botState.orderNotifications = [];

    const response = await postMidtransWebhook({
      orderId: `${created.orderNumber}-${Math.floor(Date.now() / 1000)}`,
      transactionStatus: 'settlement',
      paymentType: 'qris',
      transactionId: 'midtrans-invalid-signature',
      signatureKey: 'invalid-signature',
    });

    expect(response.status).toBe(403);

    const order = await prisma.rentalOrder.findUnique({
      where: { id: created.id },
    });
    expect(order?.rentalPaymentStatus).toBe('PENDING');
    expect(order?.status).toBe('DRAFT');
    expect(order?.paymentConfirmedAt).toBeNull();
    expect(botState.adminMessages).toHaveLength(0);
    expect(botState.orderNotifications).toHaveLength(0);
  });

  it('notifies admin for Midtrans fraud challenges without confirming or failing the ERP order', async () => {
    const created = await createWebsiteOrder(proxyClient);

    botState.adminMessages = [];
    botState.orderNotifications = [];

    const response = await postMidtransWebhook({
      orderId: `${created.orderNumber}-${Math.floor(Date.now() / 1000)}`,
      transactionStatus: 'capture',
      paymentType: 'credit_card',
      fraudStatus: 'challenge',
    });

    expect(response.status).toBe(200);

    await waitFor(
      () => botState.adminMessages.length >= 1,
      {
        description: 'Admin challenge notification',
      }
    );

    const order = await prisma.rentalOrder.findUnique({
      where: { id: created.id },
    });
    expect(order?.rentalPaymentStatus).toBe('PENDING');
    expect(order?.status).toBe('DRAFT');
    expect(order?.paymentConfirmedAt).toBeNull();
    expect(order?.paymentFailedAt).toBeNull();
    expect(botState.adminMessages).toHaveLength(1);
    expect(botState.adminMessages[0]?.phone).toBe('62800000000000');
    expect(botState.adminMessages[0]?.message).toContain(
      'PERHATIAN: PEMBAYARAN PERLU REVIEW'
    );
  });

  it('rolls back the ERP order when the live customer notification path returns a permanent invalid-number error', async () => {
    botState.invalidPhones.add('6281111111111');

    await expect(
      proxyClient.order.create.mutate({
        customerName: 'Nomor Invalid',
        customerWhatsapp: '081111111111',
        deliveryAddress: 'Jl. Kaliurang No. 7, Sleman',
        addressFields: {
          street: 'Jl. Kaliurang No. 7',
          kota: 'Sleman',
          provinsi: 'DIY',
        },
        items: [
          {
            id: 'acc-pillow',
            name: 'Extra Bantal',
            category: 'accessory',
            quantity: 1,
            pricePerDay: 10000,
            includes: ['bantal'],
          },
        ],
        totalPrice: 10000,
        orderDate: '2026-03-25T00:00:00.000Z',
        endDate: '2026-03-26T00:00:00.000Z',
        duration: 1,
        deliveryFee: 0,
        paymentMethod: 'transfer',
      })
    ).rejects.toThrow(/invalid|terdaftar/i);

    expect(
      await prisma.rentalOrder.count({
        where: { companyId: COMPANY_ID },
      })
    ).toBe(0);
    expect(
      await prisma.rentalOrderItem.count({
        where: { rentalOrder: { companyId: COMPANY_ID } },
      })
    ).toBe(0);

    expect(botState.adminMessages).toHaveLength(1);
    expect(botState.orderNotifications).toHaveLength(0);
  });
  }
);
