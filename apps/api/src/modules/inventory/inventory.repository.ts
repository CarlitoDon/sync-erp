import {
  prisma,
  InventoryMovement,
  Prisma,
} from '@sync-erp/database';

export class InventoryRepository {
  async createMovement(
    data: Prisma.InventoryMovementUncheckedCreateInput
  ): Promise<InventoryMovement> {
    return prisma.inventoryMovement.create({
      data,
    });
  }

  async findMovements(
    companyId: string,
    productId?: string
  ): Promise<InventoryMovement[]> {
    return prisma.inventoryMovement.findMany({
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
  async findById(id: string): Promise<InventoryMovement | null> {
    return prisma.inventoryMovement.findUnique({
      where: { id },
    });
  }
}
