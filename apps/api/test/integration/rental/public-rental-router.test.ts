import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
<<<<<<< HEAD
import {
  prisma,
  DepositPolicyType,
  PartnerType,
} from '@sync-erp/database';
import { appRouter } from '@src/trpc/router';
import type { Context } from '@src/trpc/context';
import { apiKeyService } from '@src/services/api-key.service';
import { webhookService } from '@src/services/webhook.service';
=======
import { prisma, PartnerType } from '@sync-erp/database';
import { appRouter } from '@src/trpc/router';
import type { Context } from '@src/trpc/context';
import { apiKeyService } from '@src/services/api-key.service';
import {
  container,
  registerServices,
  ServiceKeys,
} from '@modules/common/di';
import type { RentalWebhookService } from '@modules/rental/rental-webhook.service';
>>>>>>> origin/dev

const COMPANY_ID = 'test-public-rental-router-int-001';
const COMPANY_B_ID = 'test-public-rental-router-int-002';
const API_KEY = 'sk_test_public_rental_key';
const API_KEY_B = 'sk_test_public_rental_key_b';

<<<<<<< HEAD
=======
const mockWebhookService = {
  notifyPaymentStatus: vi.fn(),
  notifyNewOrder: vi.fn(),
  notifyOrderCreated: vi.fn(),
  notifyOrderCancelled: vi.fn(),
} as unknown as RentalWebhookService & {
  notifyNewOrder: ReturnType<typeof vi.fn>;
  notifyPaymentStatus: ReturnType<typeof vi.fn>;
};

>>>>>>> origin/dev
const buildCaller = (authorization?: string) =>
  appRouter.createCaller({
    req: {
      headers: authorization ? { authorization } : {},
    } as Context['req'],
    res: {} as Context['res'],
    userId: undefined,
    companyId: undefined,
    correlationId: 'test-public-rental-correlation',
    idempotencyKey: undefined,
    businessShape: undefined,
    userRole: undefined,
    userPermissions: [],
<<<<<<< HEAD
  });

const cleanupCompanyData = async (companyIds: string[] = [COMPANY_ID, COMPANY_B_ID]) => {
  await prisma.$transaction([
    prisma.rentalWebhookOutbox.deleteMany({
=======
    integrationId: undefined,
  });

const cleanupCompanyData = async (
  companyIds: string[] = [COMPANY_ID, COMPANY_B_ID]
) => {
  await prisma.$transaction([
    prisma.webhookOutbox.deleteMany({
>>>>>>> origin/dev
      where: { companyId: { in: companyIds } },
    }),
    prisma.rentalBundleComponent.deleteMany({
      where: { bundle: { companyId: { in: companyIds } } },
    }),
    prisma.rentalOrderItem.deleteMany({
      where: { rentalOrder: { companyId: { in: companyIds } } },
    }),
    prisma.rentalOrder.deleteMany({
      where: { companyId: { in: companyIds } },
    }),
    prisma.rentalBundle.deleteMany({
      where: { companyId: { in: companyIds } },
    }),
    prisma.rentalItem.deleteMany({
      where: { companyId: { in: companyIds } },
    }),
    prisma.documentSequence.deleteMany({
      where: { companyId: { in: companyIds } },
    }),
    prisma.product.deleteMany({
      where: { companyId: { in: companyIds } },
    }),
    prisma.partner.deleteMany({
      where: { companyId: { in: companyIds } },
    }),
  ]);
};

describe('Public Rental Router Integration', () => {
  let partnerId: string;
  let partnerIdB: string;
  let validateKeySpy: ReturnType<typeof vi.spyOn>;
<<<<<<< HEAD
  let notifyTenantSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    validateKeySpy = vi.spyOn(apiKeyService, 'validateKey');
    notifyTenantSpy = vi.spyOn(webhookService, 'notifyTenant');
=======

  beforeAll(async () => {
    container.register(
      ServiceKeys.RENTAL_WEBHOOK_SERVICE,
      () => mockWebhookService
    );
    container.reset();

    validateKeySpy = vi.spyOn(apiKeyService, 'validateKey');
>>>>>>> origin/dev

    await cleanupCompanyData();
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: {
        id: COMPANY_ID,
        name: 'Public Rental Integration Test Company',
      },
      update: {
        name: 'Public Rental Integration Test Company',
      },
    });
    await prisma.company.upsert({
      where: { id: COMPANY_B_ID },
      create: {
        id: COMPANY_B_ID,
        name: 'Public Rental Integration Test Company B',
      },
      update: {
        name: 'Public Rental Integration Test Company B',
      },
    });
  });

  beforeEach(async () => {
    vi.clearAllMocks();
<<<<<<< HEAD
    notifyTenantSpy.mockResolvedValue({
      success: true,
    });
=======
>>>>>>> origin/dev

    validateKeySpy.mockImplementation(async (rawKey: string) => {
      if (rawKey === API_KEY_B) {
        return {
          companyId: COMPANY_B_ID,
          permissions: ['rental:read', 'rental:write'],
          keyId: 'test-public-rental-key-id-b',
          rateLimit: 1000,
        };
      }

      return {
        companyId: COMPANY_ID,
        permissions: ['rental:read', 'rental:write'],
        keyId: 'test-public-rental-key-id',
        rateLimit: 1000,
      };
    });

<<<<<<< HEAD
=======
    mockWebhookService.notifyNewOrder.mockResolvedValue(undefined);
    mockWebhookService.notifyPaymentStatus.mockResolvedValue(
      undefined
    );

>>>>>>> origin/dev
    await cleanupCompanyData();

    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Test Public Rental Customer',
        phone: '628111111111',
        address: 'Jl. Test No. 1',
        type: PartnerType.CUSTOMER,
      },
    });
    partnerId = partner.id;

    const partnerB = await prisma.partner.create({
      data: {
        companyId: COMPANY_B_ID,
        name: 'Test Public Rental Customer B',
        phone: '628222222222',
        address: 'Jl. Test No. 2',
        type: PartnerType.CUSTOMER,
      },
    });
    partnerIdB = partnerB.id;
  });

  afterAll(async () => {
    validateKeySpy.mockRestore();
<<<<<<< HEAD
    notifyTenantSpy.mockRestore();
=======
>>>>>>> origin/dev
    await cleanupCompanyData();
    await prisma.company.deleteMany({
      where: { id: { in: [COMPANY_ID, COMPANY_B_ID] } },
    });
<<<<<<< HEAD
=======
    container.clear();
    registerServices();
>>>>>>> origin/dev
  });

  it('creates external orders, auto-creates catalog records, and exposes numeric DTO fields', async () => {
    const caller = buildCaller(`Bearer ${API_KEY}`);
    const startDate = new Date('2026-03-20T00:00:00.000Z');
    const endDate = new Date('2026-03-22T00:00:00.000Z');

    const created = await caller.publicRental.createOrder({
      companyId: COMPANY_ID,
      partnerId,
      rentalStartDate: startDate,
      rentalEndDate: endDate,
      deliveryFee: 15000,
      deliveryAddress: 'Jl. Malioboro No. 1, Yogyakarta',
      street: 'Jl. Malioboro No. 1',
      kota: 'Yogyakarta',
      provinsi: 'DIY',
      paymentMethod: 'qris',
      discountAmount: 10000,
      discountLabel: 'Promo Maret',
      items: [
        {
          rentalBundleId: 'package-single-standard',
          quantity: 1,
          name: 'Single Standard (Paket)',
          pricePerDay: 35000,
          category: 'package',
          components: [
            'kasur busa 90x200',
            'sprei 90x200',
            'bantal',
            'selimut',
          ],
        },
        {
          rentalItemId: 'mattress-double',
          quantity: 1,
          name: 'Double (Kasur)',
          pricePerDay: 45000,
          category: 'mattress',
          components: ['kasur busa 120x200'],
        },
      ],
    });

    expect(created.id).toBeDefined();
    expect(created.publicToken).toBeDefined();
    expect(created.orderNumber).toMatch(/^RNT-\d{6}-\d{5}$/);
    expect(created.status).toBe('DRAFT');
<<<<<<< HEAD
    expect(notifyTenantSpy).toHaveBeenCalledWith(
      COMPANY_ID,
      'rental.order.created',
      expect.objectContaining({
        order: expect.objectContaining({
          companyId: COMPANY_ID,
          publicToken: created.publicToken,
          orderNumber: created.orderNumber,
        }),
      })
=======
    expect(mockWebhookService.notifyNewOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: COMPANY_ID,
        token: created.publicToken,
        orderNumber: created.orderNumber,
        totalAmount: 165000,
      }),
      { throwOnFailure: true }
>>>>>>> origin/dev
    );

    const publicCaller = buildCaller();
    const order = await publicCaller.publicRental.getByToken({
      token: created.publicToken,
    });

    expect(order.id).toBe(created.id);
    expect(order.totalAmount).toBe(165000);
    expect(order.subtotal).toBe(160000);
    expect(typeof order.totalAmount).toBe('number');
    expect(typeof order.items[0]?.unitPrice).toBe('number');
    expect(order.items).toHaveLength(2);

    const bundle = await prisma.rentalBundle.findFirst({
      where: {
        companyId: COMPANY_ID,
        externalId: 'package-single-standard',
      },
    });
    const autoCreatedItem = await prisma.rentalItem.findFirst({
      where: {
        companyId: COMPANY_ID,
        product: {
<<<<<<< HEAD
          sku: 'EXT-kasur-busa-120x200',
=======
          sku: 'SL-kasur-busa-120x200',
>>>>>>> origin/dev
        },
      },
    });

    expect(bundle).toBeTruthy();
    expect(autoCreatedItem).toBeTruthy();
  });

<<<<<<< HEAD
  it('uses source invoice price without mutating existing master rate', async () => {
    const caller = buildCaller(`Bearer ${API_KEY}`);
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: 'RGE-160-BIRU',
        name: 'RGE 160 Biru',
        price: 0,
      },
    });
    const rentalItem = await prisma.rentalItem.create({
      data: {
        companyId: COMPANY_ID,
        productId: product.id,
        dailyRate: 50000,
        weeklyRate: 300000,
        monthlyRate: 1100000,
        depositPolicyType: DepositPolicyType.PERCENTAGE,
        depositPercentage: 50,
      },
    });

    const created = await caller.publicRental.createOrder({
      companyId: COMPANY_ID,
      partnerId,
      rentalStartDate: new Date('2026-05-26T00:00:00.000Z'),
      rentalEndDate: new Date('2026-06-01T00:00:00.000Z'),
      deliveryFee: 25000,
      items: [
        {
          rentalItemId: rentalItem.id,
          quantity: 1,
          name: 'Paket Queen 160',
          pricePerDay: 55000,
          category: 'package',
        },
      ],
    });

    const publicCaller = buildCaller();
    const order = await publicCaller.publicRental.getByToken({
      token: created.publicToken,
    });

    expect(order.subtotal).toBe(330000);
    expect(order.totalAmount).toBe(355000);
    expect(order.items[0]?.unitPrice).toBe(55000);

    const persistedLine = await prisma.rentalOrderItem.findFirstOrThrow({
      where: { rentalOrderId: created.id },
    });
    expect(persistedLine.pricingTier).toBe('CUSTOM');

    const unchangedItem = await prisma.rentalItem.findUniqueOrThrow({
      where: { id: rentalItem.id },
    });
    expect(Number(unchangedItem.dailyRate)).toBe(50000);
  });

  it('keeps exact source invoice line totals when daily rates divide unevenly', async () => {
    const caller = buildCaller(`Bearer ${API_KEY}`);
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: 'RGE-100-EXACT',
        name: 'RGE 100 Exact',
        price: 0,
      },
    });
    const rentalItem = await prisma.rentalItem.create({
      data: {
        companyId: COMPANY_ID,
        productId: product.id,
        dailyRate: 40000,
        weeklyRate: 240000,
        monthlyRate: 1000000,
        depositPolicyType: DepositPolicyType.PERCENTAGE,
        depositPercentage: 50,
      },
    });

    const created = await caller.publicRental.createOrder({
      companyId: COMPANY_ID,
      partnerId,
      rentalStartDate: new Date('2026-05-26T00:00:00.000Z'),
      rentalEndDate: new Date('2026-06-01T00:00:00.000Z'),
      deliveryFee: 43000,
      items: [
        {
          rentalItemId: rentalItem.id,
          quantity: 2,
          name: 'Exact invoice line',
          lineTotal: 647122,
          category: 'mattress',
        },
      ],
    });

    const publicCaller = buildCaller();
    const order = await publicCaller.publicRental.getByToken({
      token: created.publicToken,
    });

    expect(order.subtotal).toBe(647122);
    expect(order.totalAmount).toBe(690122);
    expect(order.items[0]?.unitPrice).toBe(53926.83);

    const persistedLine = await prisma.rentalOrderItem.findFirstOrThrow({
      where: { rentalOrderId: created.id },
    });
    expect(Number(persistedLine.subtotal)).toBe(647122);
    expect(persistedLine.pricingTier).toBe('CUSTOM');
  });

=======
>>>>>>> origin/dev
  it('updates external orders using the same resolver path without dropping requested items', async () => {
    const caller = buildCaller(`Bearer ${API_KEY}`);
    const created = await caller.publicRental.createOrder({
      companyId: COMPANY_ID,
      partnerId,
      rentalStartDate: new Date('2026-03-24T00:00:00.000Z'),
      rentalEndDate: new Date('2026-03-26T00:00:00.000Z'),
      deliveryFee: 10000,
      deliveryAddress: 'Alamat awal',
      items: [
        {
          rentalItemId: 'mattress-single-standard',
          quantity: 1,
          name: 'Single Standard (Kasur)',
          pricePerDay: 25000,
          category: 'mattress',
          components: ['kasur busa 90x200'],
        },
      ],
    });

    const updated = await caller.publicRental.updateOrder({
      token: created.publicToken,
      customerName: 'Updated Customer',
      customerPhone: '6285551234567',
      deliveryAddress: 'Jl. Update No. 2',
      paymentMethod: 'transfer',
      deliveryFee: 12000,
      discountAmount: 5000,
      discountLabel: 'Diskon Update',
      rentalStartDate: new Date('2026-03-24T00:00:00.000Z'),
      rentalEndDate: new Date('2026-03-27T00:00:00.000Z'),
      items: [
        {
          rentalBundleId: 'package-single-standard',
          quantity: 1,
          name: 'Single Standard (Paket)',
          pricePerDay: 35000,
          category: 'package',
          components: [
            'kasur busa 90x200',
            'sprei 90x200',
            'bantal',
            'selimut',
          ],
        },
        {
          rentalItemId: 'acc-pillow',
          quantity: 2,
          name: 'Extra Bantal',
          pricePerDay: 10000,
          category: 'accessory',
          components: ['bantal'],
        },
      ],
    });

    expect(updated.totalAmount).toBe(172000);

    const publicCaller = buildCaller();
    const order = await publicCaller.publicRental.getByToken({
      token: created.publicToken,
    });

    expect(order.items).toHaveLength(2);
    expect(order.totalAmount).toBe(172000);
    expect(order.discountAmount).toBe(5000);
    expect(order.paymentMethod).toBe('transfer');
    expect(order.partner.name).toBe('Updated Customer');
    expect(order.partner.phone).toBe('6285551234567');

    const dbItems = await prisma.rentalOrderItem.findMany({
      where: { rentalOrderId: created.id },
    });
    expect(dbItems).toHaveLength(2);
  });

<<<<<<< HEAD
  it('keeps external orders when generic webhook notification fails', async () => {
    const caller = buildCaller(`Bearer ${API_KEY}`);
    notifyTenantSpy.mockRejectedValueOnce(
=======
  it('rolls back external order creation when webhook notification fails', async () => {
    const caller = buildCaller(`Bearer ${API_KEY}`);
    mockWebhookService.notifyNewOrder.mockRejectedValueOnce(
>>>>>>> origin/dev
      new Error('Invalid WhatsApp Number')
    );

    await expect(
      caller.publicRental.createOrder({
        companyId: COMPANY_ID,
        partnerId,
        rentalStartDate: new Date('2026-03-28T00:00:00.000Z'),
        rentalEndDate: new Date('2026-03-30T00:00:00.000Z'),
        items: [
          {
            rentalItemId: 'acc-pillow',
            quantity: 1,
            name: 'Extra Bantal',
            pricePerDay: 10000,
            category: 'accessory',
            components: ['bantal'],
          },
        ],
      })
<<<<<<< HEAD
    ).resolves.toEqual(
      expect.objectContaining({
        orderNumber: expect.stringMatching(/^RNT-\d{6}-\d{5}$/),
        status: 'DRAFT',
      })
    );
=======
    ).rejects.toThrow('Invalid WhatsApp Number');
>>>>>>> origin/dev

    expect(
      await prisma.rentalOrder.count({
        where: { companyId: COMPANY_ID },
      })
<<<<<<< HEAD
    ).toBe(1);
=======
    ).toBe(0);
>>>>>>> origin/dev
    expect(
      await prisma.rentalOrderItem.count({
        where: { rentalOrder: { companyId: COMPANY_ID } },
      })
<<<<<<< HEAD
    ).toBe(1);
=======
    ).toBe(0);
>>>>>>> origin/dev
  });

  it('requires api key authentication for deleteOrder', async () => {
    const authedCaller = buildCaller(`Bearer ${API_KEY}`);
    const created = await authedCaller.publicRental.createOrder({
      companyId: COMPANY_ID,
      partnerId,
      rentalStartDate: new Date('2026-04-01T00:00:00.000Z'),
      rentalEndDate: new Date('2026-04-03T00:00:00.000Z'),
      items: [
        {
          rentalItemId: 'acc-bolster',
          quantity: 1,
          name: 'Extra Guling',
          pricePerDay: 10000,
          category: 'accessory',
          components: ['guling'],
        },
      ],
    });

    const publicCaller = buildCaller();

    await expect(
      publicCaller.publicRental.deleteOrder({ id: created.id })
    ).rejects.toThrow('Authorization header');

    expect(
      await prisma.rentalOrder.findUnique({
        where: { id: created.id },
      })
    ).toBeTruthy();

    await expect(
      authedCaller.publicRental.deleteOrder({ id: created.id })
    ).resolves.toEqual({ success: true });

    expect(
      await prisma.rentalOrder.findUnique({
        where: { id: created.id },
      })
    ).toBeNull();
  });

  it('auto-confirms website orders via payment confirmation by order number and requires api key auth', async () => {
    const authedCaller = buildCaller(`Bearer ${API_KEY}`);
    const created = await authedCaller.publicRental.createOrder({
      companyId: COMPANY_ID,
      partnerId,
      rentalStartDate: new Date('2026-04-05T00:00:00.000Z'),
      rentalEndDate: new Date('2026-04-07T00:00:00.000Z'),
      paymentMethod: 'qris',
      items: [
        {
          rentalItemId: 'mattress-single-standard',
          quantity: 1,
          name: 'Single Standard (Kasur)',
          pricePerDay: 25000,
          category: 'mattress',
          components: ['kasur busa 90x200'],
        },
      ],
    });

    const publicCaller = buildCaller();

    await expect(
      publicCaller.publicRental.confirmPaymentByOrderNumber({
        orderNumber: created.orderNumber,
        paymentMethod: 'qris',
        transactionId: 'midtrans-int-001',
        amount: 50000,
      })
    ).rejects.toThrow('Authorization header');

    await expect(
      authedCaller.publicRental.confirmPaymentByOrderNumber({
        orderNumber: created.orderNumber,
        paymentMethod: 'qris',
        transactionId: 'midtrans-int-001',
        amount: 50000,
      })
    ).resolves.toEqual({
      success: true,
      orderNumber: created.orderNumber,
      status: 'CONFIRMED',
    });

    const order = await prisma.rentalOrder.findUnique({
      where: { id: created.id },
    });

    expect(order?.rentalPaymentStatus).toBe('CONFIRMED');
    expect(order?.status).toBe('CONFIRMED');
    expect(order?.paymentConfirmedAt).toBeTruthy();
    expect(order?.paymentReference).toBe('midtrans-int-001');
<<<<<<< HEAD
    expect(notifyTenantSpy).toHaveBeenCalledWith(
      COMPANY_ID,
      'rental.payment.confirmed',
      expect.objectContaining({
        id: created.id,
        orderNumber: created.orderNumber,
        rentalPaymentStatus: 'CONFIRMED',
=======
    expect(
      mockWebhookService.notifyPaymentStatus
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: COMPANY_ID,
        token: created.publicToken,
        action: 'confirmed',
>>>>>>> origin/dev
        paymentMethod: 'qris',
        paymentReference: 'midtrans-int-001',
      })
    );
  });

  it('marks rejected Midtrans payments as FAILED and requires api key auth', async () => {
    const authedCaller = buildCaller(`Bearer ${API_KEY}`);
    const created = await authedCaller.publicRental.createOrder({
      companyId: COMPANY_ID,
      partnerId,
      rentalStartDate: new Date('2026-04-08T00:00:00.000Z'),
      rentalEndDate: new Date('2026-04-10T00:00:00.000Z'),
      paymentMethod: 'qris',
      items: [
        {
          rentalItemId: 'acc-bolster',
          quantity: 1,
          name: 'Extra Guling',
          pricePerDay: 10000,
          category: 'accessory',
          components: ['guling'],
        },
      ],
    });

    const publicCaller = buildCaller();

    await expect(
      publicCaller.publicRental.rejectPaymentByOrderNumber({
        orderNumber: created.orderNumber,
        paymentMethod: 'qris',
        failReason: 'Midtrans transaction expire',
      })
    ).rejects.toThrow('Authorization header');

    await expect(
      authedCaller.publicRental.rejectPaymentByOrderNumber({
        orderNumber: created.orderNumber,
        paymentMethod: 'qris',
        failReason: 'Midtrans transaction expire',
      })
    ).resolves.toEqual({
      success: true,
      orderNumber: created.orderNumber,
      status: 'FAILED',
    });

    const order = await prisma.rentalOrder.findUnique({
      where: { id: created.id },
    });

    expect(order?.rentalPaymentStatus).toBe('FAILED');
    expect(order?.status).toBe('DRAFT');
    expect(order?.paymentFailedAt).toBeTruthy();
<<<<<<< HEAD
    expect(order?.paymentFailReason).toBe('Midtrans transaction expire');
    expect(notifyTenantSpy).toHaveBeenCalledWith(
      COMPANY_ID,
      'rental.payment.rejected',
      expect.objectContaining({
        id: created.id,
        orderNumber: created.orderNumber,
        rentalPaymentStatus: 'FAILED',
=======
    expect(order?.paymentFailReason).toBe(
      'Midtrans transaction expire'
    );
    expect(
      mockWebhookService.notifyPaymentStatus
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: COMPANY_ID,
        token: created.publicToken,
        action: 'rejected',
>>>>>>> origin/dev
        paymentMethod: 'qris',
        failReason: 'Midtrans transaction expire',
      })
    );
  });

  it('keeps confirmed payments intact when a late failure webhook arrives', async () => {
    const authedCaller = buildCaller(`Bearer ${API_KEY}`);
    const created = await authedCaller.publicRental.createOrder({
      companyId: COMPANY_ID,
      partnerId,
      rentalStartDate: new Date('2026-04-11T00:00:00.000Z'),
      rentalEndDate: new Date('2026-04-13T00:00:00.000Z'),
      paymentMethod: 'qris',
      items: [
        {
          rentalItemId: 'acc-pillow',
          quantity: 1,
          name: 'Extra Bantal',
          pricePerDay: 10000,
          category: 'accessory',
          components: ['bantal'],
        },
      ],
    });

    await authedCaller.publicRental.confirmPaymentByOrderNumber({
      orderNumber: created.orderNumber,
      paymentMethod: 'qris',
      transactionId: 'midtrans-int-keep-confirmed',
      amount: 20000,
    });

    await expect(
      authedCaller.publicRental.rejectPaymentByOrderNumber({
        orderNumber: created.orderNumber,
        paymentMethod: 'qris',
        failReason: 'Midtrans transaction expire',
      })
    ).resolves.toEqual({
      success: true,
      orderNumber: created.orderNumber,
      status: 'ALREADY_CONFIRMED',
    });

    const order = await prisma.rentalOrder.findUnique({
      where: { id: created.id },
    });

    expect(order?.rentalPaymentStatus).toBe('CONFIRMED');
    expect(order?.status).toBe('CONFIRMED');
    expect(order?.paymentFailReason).toBeNull();
  });

  it('scopes payment confirmation by order number to the authenticated company', async () => {
    const callerA = buildCaller(`Bearer ${API_KEY}`);
    const callerB = buildCaller(`Bearer ${API_KEY_B}`);

    const createdA = await callerA.publicRental.createOrder({
      companyId: COMPANY_ID,
      partnerId,
      rentalStartDate: new Date('2026-04-14T00:00:00.000Z'),
      rentalEndDate: new Date('2026-04-16T00:00:00.000Z'),
      paymentMethod: 'qris',
      items: [
        {
          rentalItemId: 'acc-pillow',
          quantity: 1,
          name: 'Extra Bantal',
          pricePerDay: 10000,
          category: 'accessory',
          components: ['bantal'],
        },
      ],
    });

    const createdB = await callerB.publicRental.createOrder({
      companyId: COMPANY_B_ID,
      partnerId: partnerIdB,
      rentalStartDate: new Date('2026-04-14T00:00:00.000Z'),
      rentalEndDate: new Date('2026-04-16T00:00:00.000Z'),
      paymentMethod: 'qris',
      items: [
        {
          rentalItemId: 'acc-pillow',
          quantity: 1,
          name: 'Extra Bantal',
          pricePerDay: 10000,
          category: 'accessory',
          components: ['bantal'],
        },
      ],
    });

    expect(createdA.orderNumber).toBe(createdB.orderNumber);

    await callerA.publicRental.confirmPaymentByOrderNumber({
      orderNumber: createdA.orderNumber,
      paymentMethod: 'qris',
      transactionId: 'midtrans-company-a',
      amount: 20000,
    });

    const orderA = await prisma.rentalOrder.findUnique({
      where: { id: createdA.id },
    });
    const orderB = await prisma.rentalOrder.findUnique({
      where: { id: createdB.id },
    });

    expect(orderA?.rentalPaymentStatus).toBe('CONFIRMED');
    expect(orderB?.rentalPaymentStatus).toBe('PENDING');
  });

  it('rejects payment confirmation when Midtrans amount no longer matches the order total', async () => {
    const authedCaller = buildCaller(`Bearer ${API_KEY}`);
    const created = await authedCaller.publicRental.createOrder({
      companyId: COMPANY_ID,
      partnerId,
      rentalStartDate: new Date('2026-04-17T00:00:00.000Z'),
      rentalEndDate: new Date('2026-04-19T00:00:00.000Z'),
      paymentMethod: 'qris',
      items: [
        {
          rentalItemId: 'acc-bolster',
          quantity: 1,
          name: 'Extra Guling',
          pricePerDay: 10000,
          category: 'accessory',
          components: ['guling'],
        },
      ],
    });

    await expect(
      authedCaller.publicRental.confirmPaymentByOrderNumber({
        orderNumber: created.orderNumber,
        paymentMethod: 'qris',
        transactionId: 'midtrans-bad-amount',
        amount: 99999,
      })
    ).rejects.toThrow('Payment amount does not match');

    const order = await prisma.rentalOrder.findUnique({
      where: { id: created.id },
    });

    expect(order?.rentalPaymentStatus).toBe('PENDING');
    expect(order?.status).toBe('DRAFT');
    expect(order?.paymentConfirmedAt).toBeNull();
  });

  it('creates a fresh partner snapshot instead of mutating the existing partner when the same phone reorders with new details', async () => {
    const authedCaller = buildCaller(`Bearer ${API_KEY}`);

    const firstPartner =
      await authedCaller.publicRental.findOrCreatePartner({
        companyId: COMPANY_ID,
        name: 'Partner Awal',
        phone: '081234567890',
        address: 'Alamat Awal',
        street: 'Jl. Awal',
      });

    const secondPartner =
      await authedCaller.publicRental.findOrCreatePartner({
        companyId: COMPANY_ID,
        name: 'Partner Baru',
        phone: '081234567890',
        address: 'Alamat Baru',
        street: 'Jl. Baru',
      });

    expect(secondPartner.id).not.toBe(firstPartner.id);

    const persistedFirstPartner = await prisma.partner.findUnique({
      where: { id: firstPartner.id },
    });

    expect(persistedFirstPartner?.name).toBe('Partner Awal');
    expect(persistedFirstPartner?.address).toBe('Alamat Awal');
  });

  it('clones shared partner records on order update so sibling orders keep their original customer snapshot', async () => {
    const authedCaller = buildCaller(`Bearer ${API_KEY}`);

    const sharedPartner =
      await authedCaller.publicRental.findOrCreatePartner({
        companyId: COMPANY_ID,
        name: 'Shared Customer',
        phone: '081277788899',
        address: 'Alamat Shared',
      });

    const createdA = await authedCaller.publicRental.createOrder({
      companyId: COMPANY_ID,
      partnerId: sharedPartner.id,
      rentalStartDate: new Date('2026-04-20T00:00:00.000Z'),
      rentalEndDate: new Date('2026-04-22T00:00:00.000Z'),
      paymentMethod: 'qris',
      items: [
        {
          rentalItemId: 'acc-pillow',
          quantity: 1,
          name: 'Extra Bantal',
          pricePerDay: 10000,
          category: 'accessory',
          components: ['bantal'],
        },
      ],
    });

    const createdB = await authedCaller.publicRental.createOrder({
      companyId: COMPANY_ID,
      partnerId: sharedPartner.id,
      rentalStartDate: new Date('2026-04-20T00:00:00.000Z'),
      rentalEndDate: new Date('2026-04-22T00:00:00.000Z'),
      paymentMethod: 'qris',
      items: [
        {
          rentalItemId: 'acc-bolster',
          quantity: 1,
          name: 'Extra Guling',
          pricePerDay: 10000,
          category: 'accessory',
          components: ['guling'],
        },
      ],
    });

    await authedCaller.publicRental.updateOrder({
      token: createdB.publicToken,
      customerName: 'Updated Shared Customer',
      customerPhone: '081299900011',
      deliveryAddress: 'Alamat Update',
      items: [
        {
          rentalItemId: 'acc-bolster',
          quantity: 1,
          name: 'Extra Guling',
          pricePerDay: 10000,
          category: 'accessory',
          components: ['guling'],
        },
      ],
    });

    const [orderA, orderB] = await Promise.all([
      prisma.rentalOrder.findUnique({
        where: { id: createdA.id },
        include: { partner: true },
      }),
      prisma.rentalOrder.findUnique({
        where: { id: createdB.id },
        include: { partner: true },
      }),
    ]);

    expect(orderA?.partnerId).toBe(sharedPartner.id);
    expect(orderA?.partner.name).toBe('Shared Customer');
    expect(orderB?.partnerId).not.toBe(sharedPartner.id);
    expect(orderB?.partner.name).toBe('Updated Shared Customer');
    expect(orderB?.partner.phone).toBe('6281299900011');
  });
});
