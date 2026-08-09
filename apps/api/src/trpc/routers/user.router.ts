import { router, protectedProcedure } from '../trpc';
import {
  toPublicUser,
  UserService,
} from '../../modules/user/user.service';
import { z } from 'zod';
import { container, ServiceKeys } from '../../modules/common/di';
import { prisma } from '@sync-erp/database';

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
    .query(async ({ ctx, input }) => {
      // The user ID is only meaningful inside the admitted company scope.
      const membership = await prisma.companyMember.findUnique({
        where: {
          userId_companyId: {
            userId: input.id,
            companyId: ctx.companyId,
          },
        },
        select: { userId: true },
      });

      if (!membership) {
        return null;
      }

      const user = await userService.getById(input.id);
      return user ? toPublicUser(user) : null;
    }),
});

export type UserRouter = typeof userRouter;
