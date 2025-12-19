import { router, protectedProcedure } from '../trpc';
import {
  UserService,
  CreateUserInput,
} from '../../modules/user/user.service';
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
    .input(
      z.object({
        email: z.string().email(),
        name: z.string(),
        passwordHash: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return userService.create(
        input as CreateUserInput,
        ctx.companyId
      );
    }),
});

export type UserRouter = typeof userRouter;
