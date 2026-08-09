import {
  authenticatedProcedure,
  roleManagementProcedure,
  router,
} from '../trpc';
import { container, ServiceKeys } from '../../modules/common/di';
import {
  CreateCompanySchema,
  JoinCompanySchema,
  SelectShapeSchema,
} from '@sync-erp/shared';
import { TRPCError } from '@trpc/server';
import { CompanyService } from '../../modules/company/company.service';
import { assertBillingLimitAvailable } from '../../modules/billing/billing-limits.service';
import { z } from 'zod';

const companyService = container.resolve<CompanyService>(
  ServiceKeys.COMPANY_SERVICE
);

export const companyRouter = router({
  /**
   * List all companies for current user
   */
  list: authenticatedProcedure.query(async ({ ctx }) => {
    return companyService.listForUser(ctx.userId!);
  }),

  /**
   * Get company by ID
   */
  getById: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Company IDs are caller-controlled lookup keys; never return a company
      // that is not in the current user's membership set.
      const isMember = await companyService.isMember(
        ctx.userId!,
        input.id
      );
      if (!isMember) {
        return null;
      }

      return companyService.getById(input.id);
    }),

  /**
   * Create company
   */
  create: authenticatedProcedure
    .input(CreateCompanySchema)
    .mutation(async ({ ctx, input }) => {
      await assertBillingLimitAvailable({
        metric: 'companies',
        userId: ctx.userId,
      });

      return companyService.create(input, ctx.userId);
    }),

  /**
   * Select company business shape once after creation.
   */
  selectShape: authenticatedProcedure
    .input(
      SelectShapeSchema.extend({
        companyId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const isMember = await companyService.isMember(ctx.userId!, input.companyId);
      if (!isMember) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not authorized to select company shape',
        });
      }

      const company = await companyService.getById(input.companyId);
      if (!company) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Company not found',
        });
      }

      return companyService.selectShape(
        input.companyId,
        input.shape,
        company.businessShape
      );
    }),

  /**
   * Update member role
   */
  updateMemberRole: roleManagementProcedure
    .input(
      z.object({
        companyId: z.string().uuid(),
        userId: z.string().uuid(),
        roleId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.companyId !== ctx.companyId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Company context mismatch',
        });
      }

      return companyService.updateMemberRole(
        input.companyId,
        input.userId,
        input.roleId,
        ctx.userId!
      );
    }),

  /**
   * Join company via invite code
   */
  join: authenticatedProcedure
    .input(JoinCompanySchema)
    .mutation(async ({ ctx, input }) => {
      return companyService.join(input, ctx.userId!);
    }),
});

export type CompanyRouter = typeof companyRouter;
