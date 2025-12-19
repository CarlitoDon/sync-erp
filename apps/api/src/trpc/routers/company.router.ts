import { router, protectedProcedure } from '../trpc';
import { CompanyService } from '../../modules/company/company.service';
import {
  CreateCompanySchema,
  JoinCompanySchema,
} from '@sync-erp/shared';
import { z } from 'zod';

const companyService = new CompanyService();

export const companyRouter = router({
  /**
   * List all companies for current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return companyService.listForUser(ctx.userId!);
  }),

  /**
   * Get company by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      return companyService.getById(input.id);
    }),

  /**
   * Create company
   */
  create: protectedProcedure
    .input(CreateCompanySchema)
    .mutation(async ({ ctx, input }) => {
      return companyService.create(input, ctx.userId);
    }),

  /**
   * Join company via invite code
   */
  join: protectedProcedure
    .input(JoinCompanySchema)
    .mutation(async ({ ctx, input }) => {
      return companyService.join(input, ctx.userId!);
    }),
});

export type CompanyRouter = typeof companyRouter;
