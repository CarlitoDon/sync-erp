import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// 1. Direct sub-module imports
import * as RentalBase from '../../src/validators/rental/base.js';
import * as RentalItem from '../../src/validators/rental/item.js';
import * as RentalBooking from '../../src/validators/rental/booking.js';
import * as RentalConfirmation from '../../src/validators/rental/confirmation.js';
import * as RentalRelease from '../../src/validators/rental/release.js';
import * as RentalReturn from '../../src/validators/rental/return.js';
import * as RentalExtension from '../../src/validators/rental/extension.js';
import * as RentalQuery from '../../src/validators/rental/query.js';

// 2. Directory barrel import
import * as RentalDirBarrel from '../../src/validators/rental/index.js';

// 3. Facade barrel import
import * as RentalFacade from '../../src/validators/rental.js';

// 4. Shared validators barrel import
import * as SharedValidators from '../../src/validators/index.js';

// 5. Shared root index import
import * as SharedRoot from '../../src/index.js';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const VALID_UUID_2 = '22222222-2222-4222-8222-222222222222';
const VALID_UUID_3 = '33333333-3333-4333-8333-333333333333';

describe('Rental Validator Decomposition - Empirical Stress & Compatibility Suite', () => {
  describe('Layered Import & Export Compatibility (100% Backward Compatibility)', () => {
    it('verifies all sub-module schemas are identically exported via directory barrel', () => {
      expect(RentalDirBarrel.ApiRentalOrderStatusSchema).toBe(RentalBase.ApiRentalOrderStatusSchema);
      expect(RentalDirBarrel.CreateRentalItemSchema).toBe(RentalItem.CreateRentalItemSchema);
      expect(RentalDirBarrel.CreateRentalOrderSchema).toBe(RentalBooking.CreateRentalOrderSchema);
      expect(RentalDirBarrel.ConfirmRentalOrderSchema).toBe(RentalConfirmation.ConfirmRentalOrderSchema);
      expect(RentalDirBarrel.ReleaseRentalOrderSchema).toBe(RentalRelease.ReleaseRentalOrderSchema);
      expect(RentalDirBarrel.ProcessReturnSchema).toBe(RentalReturn.ProcessReturnSchema);
      expect(RentalDirBarrel.ExtendRentalOrderSchema).toBe(RentalExtension.ExtendRentalOrderSchema);
      expect(RentalDirBarrel.RentalReportQuerySchema).toBe(RentalQuery.RentalReportQuerySchema);
    });

    it('verifies facade rental.js preserves all exports identically', () => {
      expect(RentalFacade.ApiRentalOrderStatusSchema).toBe(RentalBase.ApiRentalOrderStatusSchema);
      expect(RentalFacade.CreateRentalItemSchema).toBe(RentalItem.CreateRentalItemSchema);
      expect(RentalFacade.CreateRentalOrderSchema).toBe(RentalBooking.CreateRentalOrderSchema);
      expect(RentalFacade.ConfirmRentalOrderSchema).toBe(RentalConfirmation.ConfirmRentalOrderSchema);
      expect(RentalFacade.ReleaseRentalOrderSchema).toBe(RentalRelease.ReleaseRentalOrderSchema);
      expect(RentalFacade.ProcessReturnSchema).toBe(RentalReturn.ProcessReturnSchema);
      expect(RentalFacade.ExtendRentalOrderSchema).toBe(RentalExtension.ExtendRentalOrderSchema);
      expect(RentalFacade.RentalReportQuerySchema).toBe(RentalQuery.RentalReportQuerySchema);
      expect(RentalFacade.RentalOrderStatus).toEqual(RentalBase.RentalOrderStatus);
    });

    it('verifies shared validators/index.js re-exports all rental schemas identically', () => {
      expect(SharedValidators.ApiRentalOrderStatusSchema).toBe(RentalBase.ApiRentalOrderStatusSchema);
      expect(SharedValidators.CreateRentalItemSchema).toBe(RentalItem.CreateRentalItemSchema);
      expect(SharedValidators.CreateRentalOrderSchema).toBe(RentalBooking.CreateRentalOrderSchema);
      expect(SharedValidators.ConfirmRentalOrderSchema).toBe(RentalConfirmation.ConfirmRentalOrderSchema);
      expect(SharedValidators.ReleaseRentalOrderSchema).toBe(RentalRelease.ReleaseRentalOrderSchema);
      expect(SharedValidators.ProcessReturnSchema).toBe(RentalReturn.ProcessReturnSchema);
      expect(SharedValidators.ExtendRentalOrderSchema).toBe(RentalExtension.ExtendRentalOrderSchema);
      expect(SharedValidators.RentalReportQuerySchema).toBe(RentalQuery.RentalReportQuerySchema);
    });

    it('verifies package root index.js re-exports all rental schemas identically', () => {
      expect(SharedRoot.ApiRentalOrderStatusSchema).toBe(RentalBase.ApiRentalOrderStatusSchema);
      expect(SharedRoot.CreateRentalItemSchema).toBe(RentalItem.CreateRentalItemSchema);
      expect(SharedRoot.CreateRentalOrderSchema).toBe(RentalBooking.CreateRentalOrderSchema);
      expect(SharedRoot.ConfirmRentalOrderSchema).toBe(RentalConfirmation.ConfirmRentalOrderSchema);
      expect(SharedRoot.ReleaseRentalOrderSchema).toBe(RentalRelease.ReleaseRentalOrderSchema);
      expect(SharedRoot.ProcessReturnSchema).toBe(RentalReturn.ProcessReturnSchema);
      expect(SharedRoot.ExtendRentalOrderSchema).toBe(RentalExtension.ExtendRentalOrderSchema);
      expect(SharedRoot.RentalReportQuerySchema).toBe(RentalQuery.RentalReportQuerySchema);
    });
  });

  describe('1. Base Schemas & Runtime Enums (rental/base.ts)', () => {
    it('parses valid ApiRentalOrderStatus and rejects invalid statuses', () => {
      const validStatuses = ['DRAFT', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED'];
      for (const s of validStatuses) {
        expect(RentalBase.ApiRentalOrderStatusSchema.parse(s)).toBe(s);
      }

      expect(() => RentalBase.ApiRentalOrderStatusSchema.parse('PENDING')).toThrow();
      expect(() => RentalBase.ApiRentalOrderStatusSchema.parse('draft')).toThrow();
      expect(() => RentalBase.ApiRentalOrderStatusSchema.parse('')).toThrow();
      expect(() => RentalBase.ApiRentalOrderStatusSchema.parse(null)).toThrow();
    });

    it('parses valid ApiRentalPaymentStatus and rejects invalid statuses', () => {
      const valid = ['PENDING', 'AWAITING_CONFIRM', 'CONFIRMED', 'FAILED'];
      for (const s of valid) {
        expect(RentalBase.ApiRentalPaymentStatusSchema.parse(s)).toBe(s);
      }

      expect(() => RentalBase.ApiRentalPaymentStatusSchema.parse('PAID')).toThrow();
      expect(() => RentalBase.ApiRentalPaymentStatusSchema.parse('DRAFT')).toThrow();
    });

    it('parses valid ApiUnitStatus and rejects invalid values', () => {
      const valid = ['AVAILABLE', 'RESERVED', 'RENTED', 'RETURNED', 'CLEANING', 'MAINTENANCE', 'RETIRED'];
      for (const s of valid) {
        expect(RentalBase.ApiUnitStatusSchema.parse(s)).toBe(s);
      }

      expect(() => RentalBase.ApiUnitStatusSchema.parse('BROKEN')).toThrow();
      expect(() => RentalBase.ApiUnitStatusSchema.parse('IN_STOCK')).toThrow();
    });

    it('parses valid ApiUnitCondition and rejects invalid conditions', () => {
      const valid = ['NEW', 'GOOD', 'FAIR', 'NEEDS_REPAIR'];
      for (const s of valid) {
        expect(RentalBase.ApiUnitConditionSchema.parse(s)).toBe(s);
      }

      expect(() => RentalBase.ApiUnitConditionSchema.parse('EXCELLENT')).toThrow();
      expect(() => RentalBase.ApiUnitConditionSchema.parse('POOR')).toThrow();
    });

    it('parses valid RentalPaymentMethod and rejects invalid methods', () => {
      const valid = ['CASH', 'BANK', 'QRIS'];
      for (const m of valid) {
        expect(RentalBase.RentalPaymentMethodSchema.parse(m)).toBe(m);
      }

      expect(() => RentalBase.RentalPaymentMethodSchema.parse('CREDIT_CARD')).toThrow();
      expect(() => RentalBase.RentalPaymentMethodSchema.parse('TRANSFER')).toThrow();
    });

    it('validates UpdateRentalPolicySchema boundaries and defaults', () => {
      // Empty object is valid (all optional)
      expect(RentalBase.UpdateRentalPolicySchema.parse({})).toEqual({});

      // Complete valid payload
      const validPayload = {
        gracePeriodHours: 24,
        lateFeeDailyRate: 50000,
        cleaningFee: 25000,
        defaultDepositPolicyType: 'PERCENTAGE' as const,
        defaultDepositPercentage: 30,
        defaultDepositPerUnit: 100000,
        pickupGracePeriodHours: 12,
      };
      expect(RentalBase.UpdateRentalPolicySchema.parse(validPayload)).toEqual(validPayload);

      // Boundary tests
      expect(() => RentalBase.UpdateRentalPolicySchema.parse({ gracePeriodHours: -1 })).toThrow();
      expect(() => RentalBase.UpdateRentalPolicySchema.parse({ gracePeriodHours: 73 })).toThrow();
      expect(() => RentalBase.UpdateRentalPolicySchema.parse({ gracePeriodHours: 12.5 })).toThrow();
      expect(() => RentalBase.UpdateRentalPolicySchema.parse({ lateFeeDailyRate: -1 })).toThrow();
      expect(() => RentalBase.UpdateRentalPolicySchema.parse({ cleaningFee: -1 })).toThrow();
      expect(() => RentalBase.UpdateRentalPolicySchema.parse({ defaultDepositPercentage: 0 })).toThrow();
      expect(() => RentalBase.UpdateRentalPolicySchema.parse({ defaultDepositPercentage: 101 })).toThrow();
      expect(() => RentalBase.UpdateRentalPolicySchema.parse({ defaultDepositPerUnit: 0 })).toThrow();
      expect(() => RentalBase.UpdateRentalPolicySchema.parse({ defaultDepositPerUnit: -100 })).toThrow();
      expect(() => RentalBase.UpdateRentalPolicySchema.parse({ pickupGracePeriodHours: -1 })).toThrow();
      expect(() => RentalBase.UpdateRentalPolicySchema.parse({ pickupGracePeriodHours: 73 })).toThrow();
    });

    it('validates UpdateCustomerRiskSchema', () => {
      const valid = {
        partnerId: VALID_UUID,
        riskLevel: 'WATCHLIST' as const,
        notes: 'Repeated late returns reported',
      };
      expect(RentalBase.UpdateCustomerRiskSchema.parse(valid)).toEqual(valid);

      // Notes min length 5
      expect(() =>
        RentalBase.UpdateCustomerRiskSchema.parse({
          partnerId: VALID_UUID,
          riskLevel: 'WATCHLIST',
          notes: 'Late',
        })
      ).toThrow();

      // Invalid UUID
      expect(() =>
        RentalBase.UpdateCustomerRiskSchema.parse({
          partnerId: 'invalid-uuid',
          riskLevel: 'WATCHLIST',
          notes: 'Valid notes',
        })
      ).toThrow();

      // Invalid risk level
      expect(() =>
        RentalBase.UpdateCustomerRiskSchema.parse({
          partnerId: VALID_UUID,
          riskLevel: 'CRITICAL',
          notes: 'Valid notes',
        })
      ).toThrow();
    });
  });

  describe('2. Rental Item Schemas (rental/item.ts)', () => {
    it('validates CreateRentalItemSchema with PERCENTAGE deposit policy', () => {
      const valid = {
        productId: VALID_UUID,
        dailyRate: 100000,
        weeklyRate: 500000, // < 7 * 100k (700k) -> OK
        monthlyRate: 2000000, // < 30 * 100k (3M) -> OK
        depositPolicyType: 'PERCENTAGE' as const,
        depositPercentage: 30,
      };
      expect(RentalItem.CreateRentalItemSchema.parse(valid)).toEqual(valid);
    });

    it('validates CreateRentalItemSchema with PER_UNIT deposit policy', () => {
      const valid = {
        productId: VALID_UUID,
        dailyRate: 100000,
        weeklyRate: 600000,
        monthlyRate: 2500000,
        depositPolicyType: 'PER_UNIT' as const,
        depositPerUnit: 500000,
      };
      expect(RentalItem.CreateRentalItemSchema.parse(valid)).toEqual(valid);
    });

    it('validates CreateRentalItemSchema with HYBRID deposit policy', () => {
      const valid = {
        productId: VALID_UUID,
        dailyRate: 100000,
        weeklyRate: 600000,
        monthlyRate: 2500000,
        depositPolicyType: 'HYBRID' as const,
        depositPercentage: 20,
        depositPerUnit: 300000,
      };
      expect(RentalItem.CreateRentalItemSchema.parse(valid)).toEqual(valid);
    });

    it('rejects weeklyRate >= 7x dailyRate for lack of economic incentive', () => {
      const invalid = {
        productId: VALID_UUID,
        dailyRate: 100000,
        weeklyRate: 700000, // 7 * 100k -> FAIL
        monthlyRate: 2000000,
        depositPolicyType: 'PERCENTAGE' as const,
        depositPercentage: 30,
      };
      expect(() => RentalItem.CreateRentalItemSchema.parse(invalid)).toThrow(
        /Weekly rate must be less than 7x daily rate/
      );
    });

    it('rejects monthlyRate >= 30x dailyRate for lack of economic incentive', () => {
      const invalid = {
        productId: VALID_UUID,
        dailyRate: 100000,
        weeklyRate: 500000,
        monthlyRate: 3000000, // 30 * 100k -> FAIL
        depositPolicyType: 'PERCENTAGE' as const,
        depositPercentage: 30,
      };
      expect(() => RentalItem.CreateRentalItemSchema.parse(invalid)).toThrow(
        /Monthly rate must be less than 30x daily rate/
      );
    });

    it('rejects deposit policy without required deposit amounts', () => {
      // PERCENTAGE missing depositPercentage
      expect(() =>
        RentalItem.CreateRentalItemSchema.parse({
          productId: VALID_UUID,
          dailyRate: 100000,
          weeklyRate: 500000,
          monthlyRate: 2000000,
          depositPolicyType: 'PERCENTAGE',
        })
      ).toThrow(/Deposit policy requires appropriate percentage/);

      // PER_UNIT missing depositPerUnit
      expect(() =>
        RentalItem.CreateRentalItemSchema.parse({
          productId: VALID_UUID,
          dailyRate: 100000,
          weeklyRate: 500000,
          monthlyRate: 2000000,
          depositPolicyType: 'PER_UNIT',
        })
      ).toThrow(/Deposit policy requires appropriate percentage/);

      // HYBRID missing depositPercentage
      expect(() =>
        RentalItem.CreateRentalItemSchema.parse({
          productId: VALID_UUID,
          dailyRate: 100000,
          weeklyRate: 500000,
          monthlyRate: 2000000,
          depositPolicyType: 'HYBRID',
          depositPerUnit: 100000,
        })
      ).toThrow(/Deposit policy requires appropriate percentage/);
    });

    it('validates UpdateRentalItemSchema', () => {
      expect(RentalItem.UpdateRentalItemSchema.parse({})).toEqual({});
      expect(
        RentalItem.UpdateRentalItemSchema.parse({
          dailyRate: 120000,
          isActive: false,
        })
      ).toEqual({ dailyRate: 120000, isActive: false });

      expect(() => RentalItem.UpdateRentalItemSchema.parse({ dailyRate: -500 })).toThrow();
    });

    it('validates UpdateUnitStatusSchema', () => {
      const valid = {
        unitId: VALID_UUID,
        status: 'MAINTENANCE' as const,
        reason: 'Broken castor wheel needs repair',
      };
      expect(RentalItem.UpdateUnitStatusSchema.parse(valid)).toEqual(valid);

      expect(() =>
        RentalItem.UpdateUnitStatusSchema.parse({
          unitId: 'not-a-uuid',
          status: 'MAINTENANCE',
        })
      ).toThrow();
    });

    it('validates ConvertStockToUnitSchema matching and mismatching length rules', () => {
      // Valid minimal
      expect(
        RentalItem.ConvertStockToUnitSchema.parse({
          rentalItemId: VALID_UUID,
          quantity: 2,
        })
      ).toEqual({
        rentalItemId: VALID_UUID,
        quantity: 2,
      });

      // Valid with unitCodes and metadata matching quantity
      const validFull = {
        rentalItemId: VALID_UUID,
        quantity: 2,
        unitCodes: ['SN-001', 'SN-002'],
        unitMetadata: [
          { unitCode: 'SN-001', sizeLabel: 'M' },
          { unitCode: 'SN-002', sizeLabel: 'L' },
        ],
      };
      expect(RentalItem.ConvertStockToUnitSchema.parse(validFull)).toEqual(validFull);

      // Mismatched unitCodes length
      expect(() =>
        RentalItem.ConvertStockToUnitSchema.parse({
          rentalItemId: VALID_UUID,
          quantity: 2,
          unitCodes: ['SN-001'],
        })
      ).toThrow(/unitCodes length must match quantity/);

      // Mismatched unitMetadata length
      expect(() =>
        RentalItem.ConvertStockToUnitSchema.parse({
          rentalItemId: VALID_UUID,
          quantity: 2,
          unitMetadata: [{ unitCode: 'SN-001' }],
        })
      ).toThrow(/unitMetadata length must match quantity/);

      // Quantity must be at least 1
      expect(() =>
        RentalItem.ConvertStockToUnitSchema.parse({
          rentalItemId: VALID_UUID,
          quantity: 0,
        })
      ).toThrow();
    });
  });

  describe('3. Booking Schemas (rental/booking.ts)', () => {
    it('parses valid CreateRentalOrderSchema and transforms dates', () => {
      const input = {
        partnerId: VALID_UUID,
        rentalStartDate: '2026-10-01T08:00:00.000Z',
        rentalEndDate: '2026-10-05T08:00:00.000Z',
        items: [
          {
            rentalItemId: VALID_UUID_2,
            quantity: 1,
            pricePerDay: 75000,
          },
        ],
        deliveryFee: 50000,
        discountAmount: 10000,
        depositAmount: 100000,
        notes: 'Deliver to front porch',
      };

      const parsed = RentalBooking.CreateRentalOrderSchema.parse(input);
      expect(parsed.rentalStartDate).toBeInstanceOf(Date);
      expect(parsed.rentalEndDate).toBeInstanceOf(Date);
      expect(parsed.rentalStartDate.toISOString()).toBe('2026-10-01T08:00:00.000Z');
      expect(parsed.rentalEndDate.toISOString()).toBe('2026-10-05T08:00:00.000Z');
      expect(parsed.partnerId).toBe(VALID_UUID);
      expect(parsed.depositAmount).toBe(100000);
      expect(parsed.items).toHaveLength(1);
    });

    it('accepts rentalBundleId as alternative to rentalItemId in items', () => {
      const input = {
        partnerId: VALID_UUID,
        rentalStartDate: '2026-10-01T08:00:00.000Z',
        rentalEndDate: '2026-10-05T08:00:00.000Z',
        items: [
          {
            rentalBundleId: VALID_UUID_3,
            quantity: 2,
          },
        ],
      };
      const parsed = RentalBooking.CreateRentalOrderSchema.parse(input);
      expect(parsed.items[0].rentalBundleId).toBe(VALID_UUID_3);
    });

    it('rejects items missing both rentalItemId and rentalBundleId', () => {
      const invalid = {
        partnerId: VALID_UUID,
        rentalStartDate: '2026-10-01T08:00:00.000Z',
        rentalEndDate: '2026-10-05T08:00:00.000Z',
        items: [
          {
            quantity: 1,
          },
        ],
      };
      expect(() => RentalBooking.CreateRentalOrderSchema.parse(invalid)).toThrow(
        /Either rentalItemId or rentalBundleId is required/
      );
    });

    it('rejects rentalEndDate <= rentalStartDate', () => {
      const invalidEqual = {
        partnerId: VALID_UUID,
        rentalStartDate: '2026-10-05T08:00:00.000Z',
        rentalEndDate: '2026-10-05T08:00:00.000Z',
        items: [{ rentalItemId: VALID_UUID_2, quantity: 1 }],
      };
      expect(() => RentalBooking.CreateRentalOrderSchema.parse(invalidEqual)).toThrow(
        /Rental end date must be after start date/
      );

      const invalidEarlier = {
        partnerId: VALID_UUID,
        rentalStartDate: '2026-10-05T08:00:00.000Z',
        rentalEndDate: '2026-10-01T08:00:00.000Z',
        items: [{ rentalItemId: VALID_UUID_2, quantity: 1 }],
      };
      expect(() => RentalBooking.CreateRentalOrderSchema.parse(invalidEarlier)).toThrow(
        /Rental end date must be after start date/
      );
    });

    it('rejects empty items array in CreateRentalOrderSchema', () => {
      const invalid = {
        partnerId: VALID_UUID,
        rentalStartDate: '2026-10-01T08:00:00.000Z',
        rentalEndDate: '2026-10-05T08:00:00.000Z',
        items: [],
      };
      expect(() => RentalBooking.CreateRentalOrderSchema.parse(invalid)).toThrow();
    });

    it('validates CancelRentalOrderSchema and CancelRentalRefundPaymentSchema', () => {
      const validWithRefund = {
        orderId: VALID_UUID,
        reason: 'Customer cancelled prior to dispatch',
        refundPayment: {
          amount: 50000,
          paymentAccountId: VALID_UUID_2,
          paymentMethod: 'BANK' as const,
        },
      };
      expect(RentalBooking.CancelRentalOrderSchema.parse(validWithRefund)).toEqual(validWithRefund);

      // Short reason (< 5 chars) fails
      expect(() =>
        RentalBooking.CancelRentalOrderSchema.parse({
          orderId: VALID_UUID,
          reason: 'No',
        })
      ).toThrow(/Cancellation reason required/);

      // Negative refund amount fails
      expect(() =>
        RentalBooking.CancelRentalOrderSchema.parse({
          orderId: VALID_UUID,
          reason: 'Valid cancellation reason',
          refundPayment: {
            amount: -5000,
          },
        })
      ).toThrow();
    });
  });

  describe('4. Confirmation Schemas (rental/confirmation.ts)', () => {
    it('validates ConfirmRentalOrderSchema defaults and assignments', () => {
      // Minimal valid
      const parsedMinimal = RentalConfirmation.ConfirmRentalOrderSchema.parse({
        orderId: VALID_UUID,
      });
      expect(parsedMinimal.orderId).toBe(VALID_UUID);
      expect(parsedMinimal.unitAssignments).toEqual([]);

      // Full valid
      const full = {
        orderId: VALID_UUID,
        depositAmount: 150000,
        paymentMethod: 'BANK' as const,
        paymentAccountId: VALID_UUID_2,
        paymentReference: 'TRX-998877',
        unitAssignments: [{ unitId: VALID_UUID_3 }],
      };
      expect(RentalConfirmation.ConfirmRentalOrderSchema.parse(full)).toEqual(full);

      // Negative deposit fails
      expect(() =>
        RentalConfirmation.ConfirmRentalOrderSchema.parse({
          orderId: VALID_UUID,
          depositAmount: -100,
        })
      ).toThrow();
    });

    it('validates ManualConfirmRentalOrderSchema requires either notes or reason', () => {
      const base = {
        orderId: VALID_UUID,
        paymentMethodId: VALID_UUID_2,
        paymentAmount: 250000,
      };

      // Missing both notes and reason fails
      expect(() => RentalConfirmation.ManualConfirmRentalOrderSchema.parse(base)).toThrow(
        /Notes or reason required for manual confirmation/
      );

      // With notes passes
      const withNotes = { ...base, notes: 'Emergency manager bypass' };
      const parsedNotes = RentalConfirmation.ManualConfirmRentalOrderSchema.parse(withNotes);
      expect(parsedNotes.notes).toBe('Emergency manager bypass');
      expect(parsedNotes.skipStockCheck).toBe(false);
      expect(parsedNotes.accountingTreatment).toBe('POST_CASH_JOURNAL');

      // With reason passes
      const withReason = { ...base, reason: 'Disetujui secara manual oleh direktur' };
      const parsedReason = RentalConfirmation.ManualConfirmRentalOrderSchema.parse(withReason);
      expect(parsedReason.reason).toBe('Disetujui secara manual oleh direktur');

      // Notes less than 5 characters fails
      expect(() =>
        RentalConfirmation.ManualConfirmRentalOrderSchema.parse({
          ...base,
          notes: 'Fail',
        })
      ).toThrow();
    });

    it('validates HistoricalRentalSettlementSchema date transform and constraints', () => {
      const input = {
        orderId: VALID_UUID,
        paymentDate: '2026-08-15T14:30:00.000Z',
        completedAt: '2026-08-15T15:00:00.000Z',
        paymentMethod: 'CASH' as const,
        paymentReference: 'HIST-001',
        notes: 'Legacy manual reconciliation',
      };

      const parsed = RentalConfirmation.HistoricalRentalSettlementSchema.parse(input);
      expect(parsed.paymentDate).toBeInstanceOf(Date);
      expect(parsed.completedAt).toBeInstanceOf(Date);
      expect(parsed.paymentDate.toISOString()).toBe('2026-08-15T14:30:00.000Z');
      expect(parsed.paymentMethod).toBe('CASH');

      // Notes < 5 chars fails
      expect(() =>
        RentalConfirmation.HistoricalRentalSettlementSchema.parse({
          ...input,
          notes: 'Bad',
        })
      ).toThrow();
    });
  });

  describe('5. Release Schemas (rental/release.ts)', () => {
    it('validates UnitReleaseSchema defaults and constraints', () => {
      const minimal = {
        unitId: VALID_UUID,
        condition: 'GOOD' as const,
      };
      const parsed = RentalRelease.UnitReleaseSchema.parse(minimal);
      expect(parsed.beforePhotos).toEqual([]);
      expect(parsed.unitId).toBe(VALID_UUID);

      expect(() =>
        RentalRelease.UnitReleaseSchema.parse({
          unitId: VALID_UUID,
          condition: 'BROKEN',
        })
      ).toThrow();
    });

    it('validates ReleasePaymentSchema settlement amount and default paymentMethod', () => {
      const parsed = RentalRelease.ReleasePaymentSchema.parse({
        settlementAmount: 250000,
      });
      expect(parsed.settlementAmount).toBe(250000);
      expect(parsed.paymentMethod).toBe('CASH');

      expect(() =>
        RentalRelease.ReleasePaymentSchema.parse({
          settlementAmount: -10,
        })
      ).toThrow();
    });

    it('validates ReleaseRentalOrderSchema requires at least one unitAssignment', () => {
      const valid = {
        orderId: VALID_UUID,
        unitAssignments: [
          {
            unitId: VALID_UUID_2,
            condition: 'NEW' as const,
            beforePhotos: [],
          },
        ],
        payment: {
          settlementAmount: 200000,
          paymentMethod: 'BANK' as const,
        },
      };
      expect(RentalRelease.ReleaseRentalOrderSchema.parse(valid)).toEqual(valid);

      // Empty unitAssignments fails
      expect(() =>
        RentalRelease.ReleaseRentalOrderSchema.parse({
          orderId: VALID_UUID,
          unitAssignments: [],
        })
      ).toThrow();
    });
  });

  describe('6. Return Schemas (rental/return.ts)', () => {
    it('validates UnitReturnSchema defaults', () => {
      const parsed = RentalReturn.UnitReturnSchema.parse({
        unitId: VALID_UUID,
      });
      expect(parsed.condition).toBe('GOOD');
      expect(parsed.afterPhotos).toEqual([]);
    });

    it('validates ReturnDamagePaymentSchema defaults', () => {
      const parsed = RentalReturn.ReturnDamagePaymentSchema.parse({
        amount: 75000,
      });
      expect(parsed.paymentMethod).toBe('CASH');
      expect(parsed.amount).toBe(75000);

      expect(() =>
        RentalReturn.ReturnDamagePaymentSchema.parse({
          amount: -50,
        })
      ).toThrow();
    });

    it('validates ProcessReturnSchema requires units or unitReturns', () => {
      // With units passes
      const withUnits = {
        orderId: VALID_UUID,
        units: [{ unitId: VALID_UUID_2 }],
      };
      const parsedUnits = RentalReturn.ProcessReturnSchema.parse(withUnits);
      expect(parsedUnits.actualReturnDate).toBeInstanceOf(Date);
      expect(parsedUnits.units).toHaveLength(1);

      // With unitReturns passes
      const withUnitReturns = {
        orderId: VALID_UUID,
        unitReturns: [{ unitId: VALID_UUID_3 }],
      };
      const parsedUnitReturns = RentalReturn.ProcessReturnSchema.parse(withUnitReturns);
      expect(parsedUnitReturns.unitReturns).toHaveLength(1);

      // With neither fails
      expect(() =>
        RentalReturn.ProcessReturnSchema.parse({
          orderId: VALID_UUID,
          units: [],
        })
      ).toThrow(/At least one unit must be returned/);
    });

    it('validates FinalizeReturnSchema', () => {
      const valid = {
        returnId: VALID_UUID,
        damageChargesOverride: 50000,
        cleaningFeesOverride: 25000,
        otherCharges: 10000,
        settlementNotes: 'Waived minor late fee',
      };
      expect(RentalReturn.FinalizeReturnSchema.parse(valid)).toEqual(valid);

      expect(() =>
        RentalReturn.FinalizeReturnSchema.parse({
          returnId: VALID_UUID,
          damageChargesOverride: -100,
        })
      ).toThrow();
    });

    it('validates CreateInvoiceFromReturnSchema date transform', () => {
      const input = {
        returnId: VALID_UUID,
        dueDate: '2026-10-30T00:00:00.000Z',
        notes: 'Final settlement invoice',
      };
      const parsed = RentalReturn.CreateInvoiceFromReturnSchema.parse(input);
      expect(parsed.dueDate).toBeInstanceOf(Date);
      expect(parsed.dueDate.toISOString()).toBe('2026-10-30T00:00:00.000Z');

      expect(() =>
        RentalReturn.CreateInvoiceFromReturnSchema.parse({
          returnId: VALID_UUID,
          dueDate: 'invalid-date',
        })
      ).toThrow();
    });
  });

  describe('7. Extension Schemas (rental/extension.ts)', () => {
    it('validates ExtendRentalOrderItemSchema requires one of 3 IDs', () => {
      // With rentalOrderItemId
      expect(
        RentalExtension.ExtendRentalOrderItemSchema.parse({
          rentalOrderItemId: VALID_UUID,
          quantity: 1,
        })
      ).toEqual({ rentalOrderItemId: VALID_UUID, quantity: 1 });

      // With rentalItemId
      expect(
        RentalExtension.ExtendRentalOrderItemSchema.parse({
          rentalItemId: VALID_UUID_2,
          quantity: 2,
        })
      ).toEqual({ rentalItemId: VALID_UUID_2, quantity: 2 });

      // With rentalBundleId
      expect(
        RentalExtension.ExtendRentalOrderItemSchema.parse({
          rentalBundleId: VALID_UUID_3,
        })
      ).toEqual({ rentalBundleId: VALID_UUID_3 });

      // Without any of the three IDs fails
      expect(() =>
        RentalExtension.ExtendRentalOrderItemSchema.parse({
          quantity: 1,
          unitPrice: 50000,
        })
      ).toThrow(/Either rentalOrderItemId, rentalItemId, or rentalBundleId is required/);
    });

    it('validates ExtendRentalOrderPaymentSchema default paymentMethod', () => {
      const parsed = RentalExtension.ExtendRentalOrderPaymentSchema.parse({
        amount: 120000,
      });
      expect(parsed.amount).toBe(120000);
      expect(parsed.paymentMethod).toBe('BANK');

      expect(() =>
        RentalExtension.ExtendRentalOrderPaymentSchema.parse({
          amount: -100,
        })
      ).toThrow();
    });

    it('validates ExtendRentalOrderSchema superRefine mutually exclusive additionalAmount when items provided', () => {
      // Valid with top-level additionalAmount (no items)
      const validAmountOnly = {
        orderId: VALID_UUID,
        newEndDate: '2026-10-20T00:00:00.000Z',
        additionalAmount: 150000,
      };
      const parsedAmount = RentalExtension.ExtendRentalOrderSchema.parse(validAmountOnly);
      expect(parsedAmount.newEndDate).toBeInstanceOf(Date);
      expect(parsedAmount.additionalAmount).toBe(150000);

      // Valid with items (no top-level additionalAmount)
      const validItemsOnly = {
        orderId: VALID_UUID,
        newEndDate: '2026-10-20T00:00:00.000Z',
        items: [
          {
            rentalItemId: VALID_UUID_2,
            quantity: 1,
            additionalAmount: 150000,
          },
        ],
      };
      expect(RentalExtension.ExtendRentalOrderSchema.parse(validItemsOnly).items).toHaveLength(1);

      // Both items and top-level additionalAmount -> superRefine violation!
      const invalidBoth = {
        orderId: VALID_UUID,
        newEndDate: '2026-10-20T00:00:00.000Z',
        additionalAmount: 150000,
        items: [
          {
            rentalItemId: VALID_UUID_2,
            quantity: 1,
          },
        ],
      };
      expect(() => RentalExtension.ExtendRentalOrderSchema.parse(invalidBoth)).toThrow(
        /Use per-item additionalAmount when items are provided/
      );
    });
  });

  describe('8. Query & Admin Task Schemas (rental/query.ts)', () => {
    it('validates RentalReportQuerySchema datetime requirements', () => {
      const valid = {
        startDate: '2026-09-01T00:00:00.000Z',
        endDate: '2026-09-30T00:00:00.000Z',
        itemId: VALID_UUID,
        category: 'Stroller',
      };
      expect(RentalQuery.RentalReportQuerySchema.parse(valid)).toEqual(valid);

      expect(() =>
        RentalQuery.RentalReportQuerySchema.parse({
          startDate: '2026-09-01', // not ISO datetime with timezone
          endDate: '2026-09-30T00:00:00.000Z',
        })
      ).toThrow();
    });

    it('validates RentalAdminTaskItemSchema and task queue response structures', () => {
      const taskItem = {
        id: 'task-1',
        orderId: VALID_UUID,
        orderNumber: 'RO-2026-001',
        partnerId: VALID_UUID_2,
        customerName: 'Budi Santoso',
        customerPhone: '08123456789',
        taskType: 'CONFIRM_AND_DP' as const,
        category: 'CONFIRMATION' as const,
        urgency: 'TODAY' as const,
        title: 'Konfirmasi Pesanan #RO-2026-001',
        description: 'Verifikasi stok dan bukti transfer DP',
        scheduledDate: '2026-09-20T00:00:00.000Z',
        daysDiff: 0,
        orderStatus: 'DRAFT' as const,
        paymentStatus: 'PENDING' as const,
        totalAmount: 500000,
        depositAmount: 150000,
        remainingAmount: 350000,
        deliveryAddress: 'Jl. Malioboro No. 12',
        itemsSummary: '1x Baby Stroller Compact',
        suggestedAction: 'CONFIRM' as const,
      };
      expect(RentalQuery.RentalAdminTaskItemSchema.parse(taskItem)).toEqual(taskItem);

      const summary = {
        totalPendingTasks: 1,
        overdueCount: 0,
        todayCount: 1,
        upcomingCount: 0,
        byCategory: {
          confirmationCount: 1,
          deliveryCount: 0,
          pelunasanCount: 0,
          pickupCount: 0,
          returnSettlementCount: 0,
        },
      };
      expect(RentalQuery.RentalAdminTaskQueueSummarySchema.parse(summary)).toEqual(summary);

      const queueResponse = {
        summary,
        tasks: [taskItem],
      };
      expect(RentalQuery.RentalAdminTaskQueueResponseSchema.parse(queueResponse)).toEqual(queueResponse);
    });

    it('validates GetRentalAdminTasksInputSchema preprocessing for empty strings and nulls', () => {
      // Empty strings and nulls should be preprocessed to undefined
      const inputWithEmpty = {
        referenceDate: '',
        category: '',
        urgency: null,
      };
      const parsedEmpty = RentalQuery.GetRentalAdminTasksInputSchema.parse(inputWithEmpty);
      expect(parsedEmpty.referenceDate).toBeUndefined();
      expect(parsedEmpty.category).toBeUndefined();
      expect(parsedEmpty.urgency).toBeUndefined();

      // Valid values should parse and coerce correctly
      const inputValid = {
        referenceDate: '2026-09-20',
        category: 'DELIVERY' as const,
        urgency: 'TODAY' as const,
      };
      const parsedValid = RentalQuery.GetRentalAdminTasksInputSchema.parse(inputValid);
      expect(parsedValid.referenceDate).toBeInstanceOf(Date);
      expect(parsedValid.category).toBe('DELIVERY');
      expect(parsedValid.urgency).toBe('TODAY');

      // Invalid urgency fails
      expect(() =>
        RentalQuery.GetRentalAdminTasksInputSchema.parse({
          urgency: 'UNKNOWN_URGENCY',
        })
      ).toThrow();
    });
  });
});
