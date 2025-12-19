import { router, protectedProcedure } from '../trpc';
import { AdminService } from '../../modules/admin/service';
import { z } from 'zod';

const adminService = new AdminService();

export const adminRouter = router({
  /**
   * Get saga logs (failed, compensated, compensation failed)
   */
  getSagaLogs: protectedProcedure
    .input(
      z.object({
        step: z.string().optional(),
        limit: z.number().default(20),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      return adminService.getSagaLogs({
        companyId: ctx.companyId!,
        step: input.step,
        limit: input.limit,
        offset: input.offset,
      });
    }),

  /**
   * Get orphan journal entries
   */
  getOrphanJournals: protectedProcedure
    .input(
      z.object({
        limit: z.number().default(20),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      return adminService.getOrphanJournals({
        companyId: ctx.companyId!,
        limit: input.limit,
        offset: input.offset,
      });
    }),
});

export type AdminRouter = typeof adminRouter;
