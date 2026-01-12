import {
  Prisma,
  prisma,
  RentalItem,
  RentalItemUnit,
  RentalOrder,
  RentalReturn,
  RentalDeposit,
  RentalPolicy,
  UnitStatus,
  RentalOrderStatus,
} from '@sync-erp/database';
import { type RentalOrderWithRelations } from '@sync-erp/shared';

export class RentalRepository {
  // ==========================================
  // Rental Item Methods
  // ==========================================

  async createRentalItem(
    data: Prisma.RentalItemCreateInput,
    tx?: Prisma.TransactionClient
  ): Promise<RentalItem> {
    const db = tx || prisma;
    return db.rentalItem.create({ data });
  }

  async updateRentalItem(
    id: string,
    data: Prisma.RentalItemUpdateInput,
    tx?: Prisma.TransactionClient
  ): Promise<RentalItem> {
    const db = tx || prisma;
    return db.rentalItem.update({
      where: { id },
      data,
    });
  }

  async findRentalItemById(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<RentalItem | null> {
    const db = tx || prisma;
    return db.rentalItem.findUnique({
      where: { id },
      include: { product: true, units: true },
    });
  }

  async listRentalItems(
    companyId: string,
    isActive?: boolean,
    tx?: Prisma.TransactionClient
  ): Promise<RentalItem[]> {
    const db = tx || prisma;
    return db.rentalItem.findMany({
      where: {
        companyId,
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        product: { include: { category: true } },
        units: {
          select: {
            id: true,
            unitCode: true,
            status: true,
            condition: true,
            rentalItemId: true,
          },
          orderBy: { unitCode: 'asc' },
        },
      },
      orderBy: { product: { name: 'asc' } },
    });
  }

  // ==========================================
  // Rental Unit Methods
  // ==========================================

  async createRentalUnit(
    data: Prisma.RentalItemUnitCreateInput,
    tx?: Prisma.TransactionClient
  ): Promise<RentalItemUnit> {
    const db = tx || prisma;
    return db.rentalItemUnit.create({ data });
  }

  async updateRentalItemUnit(
    id: string,
    data: Prisma.RentalItemUnitUpdateInput,
    tx?: Prisma.TransactionClient
  ): Promise<RentalItemUnit> {
    const db = tx || prisma;
    return db.rentalItemUnit.update({
      where: { id },
      data,
    });
  }

  async findRentalItemUnitById(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<RentalItemUnit | null> {
    const db = tx || prisma;
    return db.rentalItemUnit.findUnique({
      where: { id },
    });
  }

  async findAvailableUnits(
    rentalItemId: string,
    tx?: Prisma.TransactionClient
  ): Promise<RentalItemUnit[]> {
    const db = tx || prisma;
    return db.rentalItemUnit.findMany({
      where: {
        rentalItemId,
        status: UnitStatus.AVAILABLE,
      },
      orderBy: { unitCode: 'asc' },
    });
  }

  async findUnitByCode(
    companyId: string,
    unitCode: string,
    tx?: Prisma.TransactionClient
  ): Promise<RentalItemUnit | null> {
    const db = tx || prisma;
    return db.rentalItemUnit.findUnique({
      where: {
        companyId_unitCode: { companyId, unitCode },
      },
    });
  }

  // ==========================================
  // Rental Order Methods
  // ==========================================

  async createRentalOrder(
    data: Prisma.RentalOrderCreateInput,
    tx?: Prisma.TransactionClient
  ): Promise<RentalOrder> {
    const db = tx || prisma;
    return db.rentalOrder.create({
      data,
      include: { items: true },
    });
  }

  async findOrderById(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<RentalOrderWithRelations | null> {
    const db = tx || prisma;
    return db.rentalOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            rentalItem: {
              include: {
                product: { include: { category: true } },
                units: true,
              },
            },
          },
        },
        partner: true,
        deposit: true,
        unitAssignments: {
          include: {
            rentalItemUnit: {
              include: {
                rentalItem: {
                  include: {
                    product: { include: { category: true } },
                    units: true,
                  },
                },
              },
            },
          },
        },
        return: true,
      },
    });
  }

  async updateOrder(
    id: string,
    data: Prisma.RentalOrderUpdateInput,
    tx?: Prisma.TransactionClient
  ): Promise<RentalOrder> {
    const db = tx || prisma;
    return db.rentalOrder.update({
      where: { id },
      data,
      include: { items: true },
    });
  }

  async generateOrderNumber(
    companyId: string,
    tx?: Prisma.TransactionClient
  ): Promise<string> {
    const db = tx || prisma;
    const year = new Date().getFullYear();
    // Assuming simple counter for MVP, ideally use DocumentSequence service (T-006)
    const count = await db.rentalOrder.count({
      where: { companyId },
    });
    return `RNT-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  // ==========================================
  // Deposit & Return Methods
  // ==========================================

  async createDeposit(
    data: Prisma.RentalDepositCreateInput,
    tx?: Prisma.TransactionClient
  ): Promise<RentalDeposit> {
    const db = tx || prisma;
    return db.rentalDeposit.create({ data });
  }

  async updateDeposit(
    id: string,
    data: Prisma.RentalDepositUpdateInput,
    tx?: Prisma.TransactionClient
  ): Promise<RentalDeposit> {
    const db = tx || prisma;
    return db.rentalDeposit.update({
      where: { id },
      data,
    });
  }

  async createReturn(
    data: Prisma.RentalReturnCreateInput,
    tx?: Prisma.TransactionClient
  ): Promise<RentalReturn> {
    const db = tx || prisma;
    return db.rentalReturn.create({ data });
  }

  // ==========================================
  // Policy Methods
  // ==========================================

  async getCurrentPolicy(
    companyId: string,
    tx?: Prisma.TransactionClient
  ): Promise<RentalPolicy | null> {
    const db = tx || prisma;
    return db.rentalPolicy.findFirst({
      where: { companyId, isActive: true },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async listRentalOrders(
    companyId: string,
    filters?: {
      status?: RentalOrderStatus;
      partnerId?: string;
      dateRange?: { start: Date; end: Date };
      take?: number;
      cursor?: string;
    },
    tx?: Prisma.TransactionClient
  ): Promise<RentalOrderWithRelations[]> {
    const db = tx || prisma;
    return db.rentalOrder.findMany({
      where: {
        companyId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.partnerId && { partnerId: filters.partnerId }),
        ...(filters?.dateRange && {
          rentalStartDate: {
            gte: filters.dateRange.start,
            lte: filters.dateRange.end,
          },
        }),
      },
      include: {
        items: {
          include: {
            rentalItem: {
              include: {
                product: { include: { category: true } },
                units: true,
              },
            },
          },
        },
        partner: true,
        unitAssignments: {
          include: {
            rentalItemUnit: {
              include: {
                rentalItem: {
                  include: {
                    product: { include: { category: true } },
                    units: true,
                  },
                },
              },
            },
          },
        },
        return: true,
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.take,
      ...(filters?.cursor && {
        skip: 1,
        cursor: { id: filters.cursor },
      }),
    });
  }
}
