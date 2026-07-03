import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { prisma, PartnerType } from '@sync-erp/database';
import { apiKeyService } from '@src/services/api-key.service';
import { appRouter } from '@src/trpc/router';
import type { Context } from '@src/trpc/context';

const COMPANY_ID = 'test-rental-core-e2e-001';
const API_KEY = 'sk_core_e2e_test_key';

const buildCaller = (authorization?: string) =>
  appRouter.createCaller({
    req: {
      headers: authorization ? { authorization } : {},
    } as Context['req'],
    res: {} as Context['res'],
    userId: undefined,
    companyId: undefined,
    correlationId: 'test-core-e2e-correlation',
    idempotencyKey: undefined,
    businessShape: undefined,
    userRole: undefined,
    userPermissions: [],
  });

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

describe('Sync-ERP Core Order Creation E2E', () => {
  let partnerId: string;
  let validateKeySpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    validateKeySpy = vi.spyOn(apiKeyService, 'validateKey');
    validateKeySpy.mockResolvedValue({
      companyId: COMPANY_ID,
      permissions: ['rental:read', 'rental:write'],
      keyId: 'test-core-e2e-key-id',
      rateLimit: 1000,
    });

    await cleanupCompanyOrders();
    await prisma.apiKey.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.integration.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.partner.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: {
        id: COMPANY_ID,
        name: 'Sync-ERP Core E2E Test',
      },
      update: {
        name: 'Sync-ERP Core E2E Test',
      },
    });
  });

  beforeEach(async () => {
    await cleanupCompanyOrders();

    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Test Core E2E Customer',
        phone: '628111111111',
        address: 'Jl. Test No. 1',
        type: PartnerType.CUSTOMER,
      },
    });
    partnerId = partner.id;
  });

  afterAll(async () => {
    validateKeySpy.mockRestore();
    await cleanupCompanyOrders();
    await prisma.partner.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.apiKey.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.integration.deleteMany({
      where: { companyId: COMPANY_ID },
    });
    await prisma.company.deleteMany({
      where: { id: COMPANY_ID },
    });
  });

  it('creates a rental order via public API', async () => {
    const caller = buildCaller(`Bearer ${API_KEY}`);
    const result = await caller.publicRental.createOrder({
        companyId: COMPANY_ID,
        partnerId,
        rentalStartDate: new Date('2026-03-20T00:00:00.000Z'),
        rentalEndDate: new Date('2026-03-22T00:00:00.000Z'),
        items: [
            {
                rentalBundleId: 'package-single-standard',
                quantity: 1,
                name: 'Single Standard (Paket)',
                category: 'package',
                pricePerDay: 35000,
                lineTotal: 35000,
            },
        ],
        deliveryAddress: 'Jl. Malioboro No. 1, Yogyakarta',
    });
    expect(result.orderNumber).toMatch(/^RNT-\d{6}-\d{5}$/);
  });
});
