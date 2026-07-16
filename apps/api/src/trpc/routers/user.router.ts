import { router, protectedProcedure } from '../trpc';
import {
  toPublicUser,
  UserService,
} from '../../modules/user/user.service';
import { z } from 'zod';
import { assertBillingLimitAvailable } from '../../modules/billing/billing-limits.service';

import { container, ServiceKeys } from '../../modules/common/di';

const userService = container.resolve<UserService>(
  ServiceKeys.USER_SERVICE
);

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
<<<<<<< HEAD
      const user = await userService.getById(input.id);
      return user ? toPublicUser(user) : null;
=======
      return userService.getById(input.id);
    }),

  /**
   * Create user
   */
  create: protectedProcedure
    .input(CreateUserSchema)
    .mutation(async ({ ctx, input }) => {
      await assertBillingLimitAvailable({
        metric: 'users',
        companyId: ctx.companyId,
      });

      return userService.create(input, ctx.companyId);
>>>>>>> origin/dev
    }),
});

export type UserRouter = typeof userRouter;
