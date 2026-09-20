import { prisma } from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';
import { RENTAL_ORDER_INCLUDE } from './external-order.types.js';

export class ExternalOrderSecurityService {
  /**
   * TTL for newly minted public order tokens. The token is a tracking
   * credential for a draft order; once the order moves past DRAFT the
   * terminal cut-off in revokePublicAccessOnTerminal() also revokes it.
   */
  publicTokenExpiry(): Date {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  async getByToken(token: string) {
    const order = await prisma.rentalOrder.findFirst({
      where: {
        publicToken: token,
        publicTokenExpiresAt: { gt: new Date() },
      },
      include: RENTAL_ORDER_INCLUDE,
    });

    if (!order) {
      throw new DomainError(
        'Order not found',
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }

    return order;
  }
}
