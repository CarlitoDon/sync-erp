import {
  prisma,
  InventoryMovement,
  Prisma,
} from '@sync-erp/database';

export class InventoryRepository {
  async createMovement(
    data: Prisma.InventoryMovementUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ): Promise<InventoryMovement> {
    const db = tx || prisma;
    return db.inventoryMovement.create({
      data,
    });
  }

  async findMovements(
    companyId: string,
    productId?: string,
    tx?: Prisma.TransactionClient
  ): Promise<InventoryMovement[]> {
    const db = tx || prisma;
    return db.inventoryMovement.findMany({
      where: {
        companyId,
        ...(productId && { productId }),
      },
      include: {
        product: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Helper to find one movement if needed
  async findById(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<InventoryMovement | null> {
    const db = tx || prisma;
    return db.inventoryMovement.findUnique({
      where: { id },
    });
  }

  /**
   * Count GRN (IN) movements for a specific order.
   * Used to verify goods have been received before creating Bill.
   */
  async countByOrderReference(
    companyId: string,
    orderId: string,
    type: 'IN' | 'OUT' = 'IN',
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const db = tx || prisma;
    return db.inventoryMovement.count({
      where: {
        companyId,
        reference: { contains: orderId },
        type,
      },
    });
  }
}
