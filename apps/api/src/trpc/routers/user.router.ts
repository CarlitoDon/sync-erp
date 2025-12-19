import { router, protectedProcedure } from '../trpc';
import { UserService } from '../../modules/user/user.service';
import { CreateUserSchema } from '@sync-erp/shared';
import { z } from 'zod';

const userService = new UserService();

export const userRouter = router({
  /**
   * List users by company
   */
  listByCompany: protectedProcedure.query(async ({ ctx }) => {
    return userService.listByCompany(ctx.companyId!);
  }),

  /**
   * Get user by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      return userService.getById(input.id);
    }),

  /**
   * Create user
   */
  create: protectedProcedure
    .input(CreateUserSchema)
    .mutation(async ({ ctx, input }) => {
      return userService.create(input, ctx.companyId);
    }),
});

export type UserRouter = typeof userRouter;
