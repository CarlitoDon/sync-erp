import { router, protectedProcedure } from '../trpc';
import {
  toPublicUser,
  UserService,
} from '../../modules/user/user.service';
import { z } from 'zod';

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
      const user = await userService.getById(input.id);
      return user ? toPublicUser(user) : null;
    }),
});

export type UserRouter = typeof userRouter;
