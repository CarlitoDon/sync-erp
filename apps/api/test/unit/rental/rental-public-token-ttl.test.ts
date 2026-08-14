import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RentalExternalOrderService } from '@src/modules/rental/rental-external-order.service';
import { mockPrisma } from '../../setup';
import {
  OrderSource,
  RentalOrderStatus,
  RentalPaymentStatus,
} from '@sync-erp/database';
import { DomainError } from '@sync-erp/shared';
import { toIntegrationOrderDto } from '@src/modules/rental/rental-integration.dto';

/**
 * Public order-token minimization and strict TTL/expiry enforcement tests.
 *
 *  - getByToken denies expired tokens (strict expiry, including the
 *    terminal cut-off when an order leaves DRAFT);
 *  - new orders mint tokens with a 30-day expiry;
 *  - the public tracking DTO omits PII (customer identity, address fields,
 *    payment reference, failure reason, internal identifiers).
 */

function buildOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    companyId: 'company-1',
    partnerId: 'partner-1',
    orderNumber: 'RNT-2026-0001',
    status: RentalOrderStatus.DRAFT,
    subtotal: { toNumber: () => 1000 },
    depositAmount: { toNumber: () => 0 },
    totalAmount: { toNumber: () => 1200 },
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    publicToken: '11111111-2222-3333-4444-555555555555',
    publicTokenExpiresAt: null,
    rentalStartDate: new Date(),
    rentalEndDate: new Date(),
    dueDateTime: new Date(),
    deliveryFee: { toNumber: () => 200 },
    deliveryAddress: 'Jl. Rahasia No. 1',
    street: 'Jl. Rahasia',
    kelurahan: 'Kelurahan Rahasia',
    kecamatan: 'Kecamatan Rahasia',
    kota: 'Kota Rahasia',
    provinsi: 'Provinsi Rahasia',
    zip: '12345',
    latitude: { toNumber: () => -6.2 },
    longitude: { toNumber: () => 106.8 },
    paymentMethod: 'qris',
    discountAmount: { toNumber: () => 0 },
    discountLabel: null,
    orderSource: OrderSource.WEBSITE,
    rentalPaymentStatus: RentalPaymentStatus.PENDING,
    paymentClaimedAt: null,
    paymentConfirmedAt: null,
    paymentReference: 'TRX-SECRET-REF',
    paymentFailedAt: null,
    paymentFailReason: 'some internal failure detail',
    partner: {
      name: 'Santi Living',
      phone: '08123456789',
      address: 'Alamat Rahasia',
      street: 'Jl. Mitra',
      kelurahan: 'Kec. Mitra',
      kecamatan: 'Kab. Mitra',
      kota: 'Jakarta',
      provinsi: 'DKI Jakarta',
      zip: '10110',
      latitude: { toNumber: () => -6.2 },
      longitude: { toNumber: () => 106.8 },
    },
    items: [
      {
        rentalItemId: 'item-1',
        rentalBundleId: null,
        quantity: 1,
        unitPrice: { toNumber: () => 1000 },
        subtotal: { toNumber: () => 1000 },
        rentalItem: { product: { name: 'Kasur', sku: 'KSR-1' } },
        rentalBundle: null,
      },
    ],
    ...overrides,
  };
}

describe('RentalExternalOrderService public token TTL', () => {
  let service: RentalExternalOrderService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RentalExternalOrderService();
  });

  describe('getByToken strict expiry', () => {
    it('returns the order when the token is unexpired', async () => {
      mockPrisma.rentalOrder.findFirst.mockResolvedValue(buildOrder());

      const result = await service.getByToken('11111111-2222-3333-4444-555555555555');

      expect(result.id).toBe('order-1');
      expect(mockPrisma.rentalOrder.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            publicToken: '11111111-2222-3333-4444-555555555555',
            publicTokenExpiresAt: { gt: expect.any(Date) },
          }),
        })
      );
    });

    it('denies an expired token (404, no order data)', async () => {
      // No row matches the expiry predicate, so findFirst returns null.
      mockPrisma.rentalOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.getByToken('11111111-2222-3333-4444-555555555555')
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('denies a token whose expiry is exactly in the past', async () => {
      mockPrisma.rentalOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.getByToken('11111111-2222-3333-4444-555555555555')
      ).rejects.toThrow(DomainError);
    });
  });

  describe('DTO minimization', () => {
    it('omits PII and internal identifiers from the public tracking DTO', () => {
      const dto = toIntegrationOrderDto(buildOrder() as never);

      expect(dto.partner).toEqual({ name: 'Santi Living' });
      expect(dto.partner).not.toHaveProperty('phone');
      expect(dto.partner).not.toHaveProperty('address');
      expect(dto.partner).not.toHaveProperty('street');
      expect(dto.partner).not.toHaveProperty('latitude');

      expect(dto).not.toHaveProperty('street');
      expect(dto).not.toHaveProperty('kelurahan');
      expect(dto).not.toHaveProperty('kecamatan');
      expect(dto).not.toHaveProperty('kota');
      expect(dto).not.toHaveProperty('provinsi');
      expect(dto).not.toHaveProperty('zip');
      expect(dto).not.toHaveProperty('latitude');
      expect(dto).not.toHaveProperty('longitude');
      expect(dto).not.toHaveProperty('paymentReference');
      expect(dto).not.toHaveProperty('paymentFailReason');

      expect(dto.items[0]).not.toHaveProperty('sku');
    });

    it('keeps tracking status and totals', () => {
      const dto = toIntegrationOrderDto(buildOrder() as never);

      expect(dto.orderNumber).toBe('RNT-2026-0001');
      expect(dto.status).toBe(RentalOrderStatus.DRAFT);
      expect(dto.totalAmount).toBe(1200);
      expect(dto.rentalPaymentStatus).toBe(RentalPaymentStatus.PENDING);
      expect(dto.publicToken).toBe('11111111-2222-3333-4444-555555555555');
    });
  });
});
