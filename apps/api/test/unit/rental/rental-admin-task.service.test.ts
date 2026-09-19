import { describe, expect, it, beforeEach } from 'vitest';
import { RentalAdminTaskService } from '../../../src/modules/rental/rental-admin-task.service';
import {
  prisma,
  RentalOrderStatus,
  RentalPaymentStatus,
  ReturnStatus,
} from '@sync-erp/database';
import { asMock } from '@sync-erp/shared';
import { Decimal } from 'decimal.js';

describe('RentalAdminTaskService', () => {
  const COMPANY_ID = 'test-company-id';
  const refDate = new Date('2026-09-19T00:00:00.000Z');

  let service: RentalAdminTaskService;

  beforeEach(() => {
    service = new RentalAdminTaskService();
  });

  it('generates CONFIRM_AND_DP tasks for DRAFT orders with appropriate urgency', async () => {
    const overdueDraft = {
      id: '11111111-1111-1111-1111-111111111111',
      orderNumber: 'RO-DRAFT-OVERDUE',
      companyId: COMPANY_ID,
      partnerId: '22222222-2222-2222-2222-222222222222',
      status: RentalOrderStatus.DRAFT,
      rentalPaymentStatus: RentalPaymentStatus.PENDING,
      rentalStartDate: new Date('2026-09-17T00:00:00.000Z'), // 2 days late
      rentalEndDate: new Date('2026-09-20T00:00:00.000Z'),
      totalAmount: new Decimal(150000),
      depositAmount: new Decimal(0),
      deliveryAddress: 'Jl. Malioboro No. 1',
      partner: {
        name: 'Budi Santoso',
        phone: '081234567890',
      },
      items: [
        {
          quantity: 1,
          rentalBundle: { name: 'Paket Kost Hemat', shortName: 'Kost Hemat' },
          rentalItem: null,
        },
      ],
      deposit: null,
    };

    const todayDraft = {
      id: '33333333-3333-3333-3333-333333333333',
      orderNumber: 'RO-DRAFT-TODAY',
      companyId: COMPANY_ID,
      partnerId: '44444444-4444-4444-4444-444444444444',
      status: RentalOrderStatus.DRAFT,
      rentalPaymentStatus: RentalPaymentStatus.PENDING,
      rentalStartDate: new Date('2026-09-19T00:00:00.000Z'), // Today
      rentalEndDate: new Date('2026-09-22T00:00:00.000Z'),
      totalAmount: new Decimal(200000),
      depositAmount: new Decimal(50000),
      deliveryAddress: 'Jl. Kaliurang KM 5',
      partner: {
        name: 'Siti Rahma',
        phone: '08987654321',
      },
      items: [
        {
          quantity: 2,
          rentalBundle: null,
          rentalItem: { product: { name: 'Kasur Busa 120x200' } },
        },
      ],
      deposit: null,
    };

    asMock(prisma.rentalOrder.findMany).mockResolvedValue([overdueDraft, todayDraft]);
    asMock(prisma.rentalReturn.findMany).mockResolvedValue([]);

    const result = await service.getAdminTaskQueue(COMPANY_ID, { referenceDate: refDate });

    expect(result.summary.totalPendingTasks).toBe(2);
    expect(result.summary.overdueCount).toBe(1);
    expect(result.summary.todayCount).toBe(1);
    expect(result.summary.byCategory.confirmationCount).toBe(2);

    const taskOverdue = result.tasks.find((t) => t.orderNumber === 'RO-DRAFT-OVERDUE');
    expect(taskOverdue).toBeDefined();
    expect(taskOverdue?.taskType).toBe('CONFIRM_AND_DP');
    expect(taskOverdue?.urgency).toBe('OVERDUE');
    expect(taskOverdue?.daysDiff).toBeLessThan(0);
    expect(taskOverdue?.suggestedAction).toBe('CONFIRM');

    const taskToday = result.tasks.find((t) => t.orderNumber === 'RO-DRAFT-TODAY');
    expect(taskToday).toBeDefined();
    expect(taskToday?.taskType).toBe('CONFIRM_AND_DP');
    expect(taskToday?.urgency).toBe('TODAY');
    expect(taskToday?.daysDiff).toBe(0);
  });

  it('generates VERIFY_PAYMENT tasks for orders with AWAITING_CONFIRM payment', async () => {
    const paymentOrder = {
      id: '55555555-5555-5555-5555-555555555555',
      orderNumber: 'RO-PAYMENT-WAITING',
      companyId: COMPANY_ID,
      partnerId: '66666666-6666-6666-6666-666666666666',
      status: RentalOrderStatus.DRAFT,
      rentalPaymentStatus: RentalPaymentStatus.AWAITING_CONFIRM,
      rentalStartDate: new Date('2026-09-20T00:00:00.000Z'),
      rentalEndDate: new Date('2026-09-23T00:00:00.000Z'),
      totalAmount: new Decimal(250000),
      depositAmount: new Decimal(0),
      deliveryAddress: 'Jl. Gejayan',
      partner: {
        name: 'Ahmad Fauzi',
        phone: '081122334455',
      },
      items: [],
      deposit: null,
    };

    asMock(prisma.rentalOrder.findMany).mockResolvedValue([paymentOrder]);
    asMock(prisma.rentalReturn.findMany).mockResolvedValue([]);

    const result = await service.getAdminTaskQueue(COMPANY_ID, { referenceDate: refDate });

    const verifyTask = result.tasks.find((t) => t.taskType === 'VERIFY_PAYMENT');
    expect(verifyTask).toBeDefined();
    expect(verifyTask?.urgency).toBe('TODAY');
    expect(verifyTask?.suggestedAction).toBe('VERIFY_PAYMENT');
    expect(verifyTask?.title).toContain('Ahmad Fauzi');
  });

  it('generates DELIVERY_DISPATCH and PELUNASAN tasks for CONFIRMED orders', async () => {
    const confirmedOrder = {
      id: '77777777-7777-7777-7777-777777777777',
      orderNumber: 'RO-CONFIRMED-DELIVERY',
      companyId: COMPANY_ID,
      partnerId: '88888888-8888-8888-8888-888888888888',
      status: RentalOrderStatus.CONFIRMED,
      rentalPaymentStatus: RentalPaymentStatus.PENDING,
      rentalStartDate: new Date('2026-09-19T00:00:00.000Z'), // Deliver today
      rentalEndDate: new Date('2026-09-25T00:00:00.000Z'),
      totalAmount: new Decimal(300000),
      depositAmount: new Decimal(100000), // DP paid, remaining 200,000
      deliveryAddress: 'Jl. Palagan KM 8',
      partner: {
        name: 'Dewi Lestari',
        phone: '085566778899',
      },
      items: [
        {
          quantity: 1,
          rentalBundle: null,
          rentalItem: { product: { name: 'Kasur 160x200' } },
        },
      ],
      deposit: null,
    };

    asMock(prisma.rentalOrder.findMany).mockResolvedValue([confirmedOrder]);
    asMock(prisma.rentalReturn.findMany).mockResolvedValue([]);

    const result = await service.getAdminTaskQueue(COMPANY_ID, { referenceDate: refDate });

    // Should generate 2 tasks: DELIVERY_DISPATCH and PELUNASAN_PAYMENT
    const deliveryTask = result.tasks.find((t) => t.taskType === 'DELIVERY_DISPATCH');
    expect(deliveryTask).toBeDefined();
    expect(deliveryTask?.urgency).toBe('TODAY');
    expect(deliveryTask?.suggestedAction).toBe('RELEASE');

    const pelunasanTask = result.tasks.find((t) => t.taskType === 'PELUNASAN_PAYMENT');
    expect(pelunasanTask).toBeDefined();
    expect(pelunasanTask?.remainingAmount).toBe(200000);
    expect(pelunasanTask?.suggestedAction).toBe('RECORD_PELUNASAN');
  });

  it('generates PICKUP_RETURN tasks for ACTIVE orders near or past end date', async () => {
    const overdueActiveOrder = {
      id: '99999999-9999-9999-9999-999999999999',
      orderNumber: 'RO-ACTIVE-OVERDUE',
      companyId: COMPANY_ID,
      partnerId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      status: RentalOrderStatus.ACTIVE,
      rentalPaymentStatus: RentalPaymentStatus.CONFIRMED,
      rentalStartDate: new Date('2026-09-10T00:00:00.000Z'),
      rentalEndDate: new Date('2026-09-17T00:00:00.000Z'), // 2 days overdue
      totalAmount: new Decimal(500000),
      depositAmount: new Decimal(500000),
      deliveryAddress: 'Jl. Seturan',
      partner: {
        name: 'Rian Pratama',
        phone: '087788990011',
      },
      items: [
        {
          quantity: 1,
          rentalBundle: null,
          rentalItem: { product: { name: 'Kasur 100x200' } },
        },
      ],
      deposit: null,
    };

    asMock(prisma.rentalOrder.findMany).mockResolvedValue([overdueActiveOrder]);
    asMock(prisma.rentalReturn.findMany).mockResolvedValue([]);

    const result = await service.getAdminTaskQueue(COMPANY_ID, { referenceDate: refDate });

    const pickupTask = result.tasks.find((t) => t.taskType === 'PICKUP_RETURN');
    expect(pickupTask).toBeDefined();
    expect(pickupTask?.urgency).toBe('OVERDUE');
    expect(pickupTask?.suggestedAction).toBe('EXTEND');
  });

  it('generates SETTLE_RETURN tasks for DRAFT returns', async () => {
    const draftReturn = {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      companyId: COMPANY_ID,
      rentalOrderId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      returnedAt: new Date('2026-09-18T14:00:00.000Z'),
      settlementStatus: ReturnStatus.DRAFT,
      rentalOrder: {
        id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        orderNumber: 'RO-RETURN-DRAFT',
        partnerId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        status: RentalOrderStatus.ACTIVE,
        rentalPaymentStatus: RentalPaymentStatus.CONFIRMED,
        totalAmount: new Decimal(400000),
        depositAmount: new Decimal(200000),
        deliveryAddress: 'Jl. Bantul KM 4',
        partner: {
          name: 'Irma Suryani',
          phone: '081399887766',
        },
      },
    };

    asMock(prisma.rentalOrder.findMany).mockResolvedValue([]);
    asMock(prisma.rentalReturn.findMany).mockResolvedValue([draftReturn]);

    const result = await service.getAdminTaskQueue(COMPANY_ID, { referenceDate: refDate });

    const returnTask = result.tasks.find((t) => t.taskType === 'SETTLE_RETURN');
    expect(returnTask).toBeDefined();
    expect(returnTask?.urgency).toBe('TODAY');
    expect(returnTask?.category).toBe('RETURN');
    expect(returnTask?.suggestedAction).toBe('SETTLE_RETURN');
    expect(result.summary.byCategory.returnSettlementCount).toBe(1);
  });

  it('filters tasks by category and urgency correctly while preserving summary metrics', async () => {
    const draftOrder = {
      id: '11111111-1111-1111-1111-111111111111',
      orderNumber: 'RO-1',
      companyId: COMPANY_ID,
      partnerId: '22222222-2222-2222-2222-222222222222',
      status: RentalOrderStatus.DRAFT,
      rentalPaymentStatus: RentalPaymentStatus.PENDING,
      rentalStartDate: new Date('2026-09-17T00:00:00.000Z'), // OVERDUE CONFIRMATION
      rentalEndDate: new Date('2026-09-20T00:00:00.000Z'),
      totalAmount: new Decimal(150000),
      depositAmount: new Decimal(0),
      deliveryAddress: 'Jl. Kaliurang',
      partner: { name: 'Customer A', phone: null },
      items: [],
      deposit: null,
    };

    const confirmedOrder = {
      id: '33333333-3333-3333-3333-333333333333',
      orderNumber: 'RO-2',
      companyId: COMPANY_ID,
      partnerId: '44444444-4444-4444-4444-444444444444',
      status: RentalOrderStatus.CONFIRMED,
      rentalPaymentStatus: RentalPaymentStatus.CONFIRMED,
      rentalStartDate: new Date('2026-09-19T00:00:00.000Z'), // TODAY DELIVERY
      rentalEndDate: new Date('2026-09-22T00:00:00.000Z'),
      totalAmount: new Decimal(200000),
      depositAmount: new Decimal(200000),
      deliveryAddress: 'Jl. Gejayan',
      partner: { name: 'Customer B', phone: null },
      items: [],
      deposit: null,
    };

    asMock(prisma.rentalOrder.findMany).mockResolvedValue([draftOrder, confirmedOrder]);
    asMock(prisma.rentalReturn.findMany).mockResolvedValue([]);

    // Filter by DELIVERY only
    const deliveryOnly = await service.getAdminTaskQueue(COMPANY_ID, {
      referenceDate: refDate,
      category: 'DELIVERY',
    });

    expect(deliveryOnly.summary.totalPendingTasks).toBe(2); // Total across all categories
    expect(deliveryOnly.tasks.length).toBe(1);
    expect(deliveryOnly.tasks[0]?.taskType).toBe('DELIVERY_DISPATCH');

    // Filter by OVERDUE urgency only
    const overdueOnly = await service.getAdminTaskQueue(COMPANY_ID, {
      referenceDate: refDate,
      urgency: 'OVERDUE',
    });

    expect(overdueOnly.summary.totalPendingTasks).toBe(2);
    expect(overdueOnly.tasks.length).toBe(1);
    expect(overdueOnly.tasks[0]?.urgency).toBe('OVERDUE');
  });

  it('does not generate PICKUP_RETURN tasks for ACTIVE orders ending far in the future (> 3 days)', async () => {
    const longTermActive = {
      id: 'active-long-term-id',
      orderNumber: 'RO-ACTIVE-LONG-TERM',
      companyId: COMPANY_ID,
      partnerId: 'cust-1',
      status: RentalOrderStatus.ACTIVE,
      rentalPaymentStatus: RentalPaymentStatus.CONFIRMED,
      rentalStartDate: new Date('2026-09-01T00:00:00.000Z'),
      rentalEndDate: new Date('2026-10-19T00:00:00.000Z'), // 30 days away
      totalAmount: new Decimal(1000000),
      depositAmount: new Decimal(1000000),
      deliveryAddress: 'Jl. Kaliurang KM 12',
      partner: { name: 'Customer Far', phone: '08123456789' },
      items: [],
      deposit: null,
    };

    asMock(prisma.rentalOrder.findMany).mockResolvedValue([longTermActive]);
    asMock(prisma.rentalReturn.findMany).mockResolvedValue([]);

    const result = await service.getAdminTaskQueue(COMPANY_ID, {
      referenceDate: refDate,
    });

    expect(result.summary.totalPendingTasks).toBe(0);
    expect(result.tasks.length).toBe(0);
  });

  it('does not generate conflicting PELUNASAN_PAYMENT task when order is AWAITING_CONFIRM', async () => {
    const awaitingConfirmOrder = {
      id: 'awaiting-order-id',
      orderNumber: 'RO-AWAITING-PAYMENT',
      companyId: COMPANY_ID,
      partnerId: 'cust-2',
      status: RentalOrderStatus.CONFIRMED,
      rentalPaymentStatus: RentalPaymentStatus.AWAITING_CONFIRM,
      rentalStartDate: new Date('2026-09-19T00:00:00.000Z'),
      rentalEndDate: new Date('2026-09-25T00:00:00.000Z'),
      totalAmount: new Decimal(300000),
      depositAmount: new Decimal(100000),
      deliveryAddress: 'Jl. Gejayan',
      partner: { name: 'Customer Awaiting', phone: '08123456789' },
      items: [],
      deposit: null,
      paymentClaimedAt: new Date('2026-09-19T06:00:00.000Z'),
    };

    asMock(prisma.rentalOrder.findMany).mockResolvedValue([awaitingConfirmOrder]);
    asMock(prisma.rentalReturn.findMany).mockResolvedValue([]);

    const result = await service.getAdminTaskQueue(COMPANY_ID, {
      referenceDate: refDate,
    });

    // Should have VERIFY_PAYMENT and DELIVERY_DISPATCH, but NOT PELUNASAN_PAYMENT
    const verifyTask = result.tasks.find((t) => t.taskType === 'VERIFY_PAYMENT');
    const pelunasanTask = result.tasks.find((t) => t.taskType === 'PELUNASAN_PAYMENT');

    expect(verifyTask).toBeDefined();
    expect(pelunasanTask).toBeUndefined();
  });

  it('marks pelunasan as OVERDUE when rentalStartDate is in the past for active order', async () => {
    const overduePelunasanOrder = {
      id: 'active-unpaid-order-id',
      orderNumber: 'RO-ACTIVE-UNPAID',
      companyId: COMPANY_ID,
      partnerId: 'cust-3',
      status: RentalOrderStatus.ACTIVE,
      rentalPaymentStatus: RentalPaymentStatus.PENDING,
      rentalStartDate: new Date('2026-09-15T00:00:00.000Z'), // 4 days ago
      rentalEndDate: new Date('2026-09-25T00:00:00.000Z'),
      totalAmount: new Decimal(300000),
      depositAmount: new Decimal(90000),
      deliveryAddress: 'Jl. Kaliurang',
      partner: { name: 'Customer Late Payment', phone: '08123456789' },
      items: [],
      deposit: null,
    };

    asMock(prisma.rentalOrder.findMany).mockResolvedValue([overduePelunasanOrder]);
    asMock(prisma.rentalReturn.findMany).mockResolvedValue([]);

    const result = await service.getAdminTaskQueue(COMPANY_ID, {
      referenceDate: refDate,
    });

    const pelunasanTask = result.tasks.find((t) => t.taskType === 'PELUNASAN_PAYMENT');
    expect(pelunasanTask).toBeDefined();
    expect(pelunasanTask?.urgency).toBe('OVERDUE');
    expect(pelunasanTask?.daysDiff).toBeLessThan(0);
  });

  it('does not generate duplicate PICKUP_RETURN task when an order already has a draft return', async () => {
    const activeOrderWithDraftReturn = {
      id: 'active-returning-id',
      orderNumber: 'RO-ACTIVE-RETURNING',
      companyId: COMPANY_ID,
      partnerId: 'cust-4',
      status: RentalOrderStatus.ACTIVE,
      rentalPaymentStatus: RentalPaymentStatus.CONFIRMED,
      rentalStartDate: new Date('2026-09-10T00:00:00.000Z'),
      rentalEndDate: new Date('2026-09-19T00:00:00.000Z'), // Today
      totalAmount: new Decimal(200000),
      depositAmount: new Decimal(200000),
      deliveryAddress: 'Jl. Gejayan',
      partner: { name: 'Customer Returning', phone: '08123456789' },
      items: [],
      deposit: null,
    };

    const draftReturn = {
      id: 'draft-return-1',
      companyId: COMPANY_ID,
      rentalOrderId: 'active-returning-id',
      returnedAt: new Date('2026-09-19T10:00:00.000Z'),
      settlementStatus: ReturnStatus.DRAFT,
      rentalOrder: activeOrderWithDraftReturn,
    };

    asMock(prisma.rentalOrder.findMany).mockResolvedValue([activeOrderWithDraftReturn]);
    asMock(prisma.rentalReturn.findMany).mockResolvedValue([draftReturn]);

    const result = await service.getAdminTaskQueue(COMPANY_ID, {
      referenceDate: refDate,
    });

    const pickupTask = result.tasks.find((t) => t.taskType === 'PICKUP_RETURN');
    const returnTask = result.tasks.find((t) => t.taskType === 'SETTLE_RETURN');

    expect(pickupTask).toBeUndefined();
    expect(returnTask).toBeDefined();
  });
});
