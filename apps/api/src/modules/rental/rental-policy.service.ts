/**
 * Rental Policy Service
 *
 * Handles rental policy management including late fees, cleaning fees, and deposit policies.
 * Extracted from rental.service.ts for better maintainability.
 */

import { prisma } from '@sync-erp/database';
import {
  RentalPolicy,
  EntityType,
  AuditLogAction,
} from '@sync-erp/database';
import { RentalRepository } from './rental.repository';
import { recordAudit } from '../common/audit/audit-log.service';
import { Decimal } from 'decimal.js';

export class RentalPolicyService {
  constructor(
    private readonly repository: RentalRepository = new RentalRepository()
  ) {}

  async getCurrentPolicy(
    companyId: string
  ): Promise<RentalPolicy | null> {
    return this.repository.getCurrentPolicy(companyId);
  }

  async updatePolicy(
    companyId: string,
    data: {
      gracePeriodHours?: number;
      lateFeeDailyRate?: number;
      cleaningFee?: number;
      pickupGracePeriodHours?: number;
    },
    userId: string
  ): Promise<RentalPolicy> {
    return prisma.$transaction(async (tx) => {
      // Mark current policy inactive
      const current = await this.repository.getCurrentPolicy(
        companyId,
        tx
      );
      if (current) {
        await tx.rentalPolicy.update({
          where: { id: current.id },
          data: { isActive: false, replacedAt: new Date() },
        });
      }

      // Create new policy
      const newPolicy = await tx.rentalPolicy.create({
        data: {
          company: { connect: { id: companyId } },
          gracePeriodHours:
            data.gracePeriodHours ?? current?.gracePeriodHours ?? 2,
          lateFeeDailyRate: data.lateFeeDailyRate
            ? new Decimal(data.lateFeeDailyRate)
            : (current?.lateFeeDailyRate ?? new Decimal(0)),
          cleaningFee: data.cleaningFee
            ? new Decimal(data.cleaningFee)
            : (current?.cleaningFee ?? new Decimal(0)),
          pickupGracePeriodHours:
            data.pickupGracePeriodHours ??
            current?.pickupGracePeriodHours ??
            24,
          defaultDepositPolicyType:
            current?.defaultDepositPolicyType ?? 'PERCENTAGE',
          createdBy: userId,
          isActive: true,
          effectiveFrom: new Date(),
        },
      });

      await recordAudit({
        companyId,
        actorId: userId,
        action: AuditLogAction.RENTAL_ITEM_CREATED,
        entityType: EntityType.RENTAL_POLICY,
        entityId: newPolicy.id,
        businessDate: new Date(),
      });

      return newPolicy;
    });
  }
}
