import { prisma } from '@sync-erp/database';
import { RentalOrderStatus } from '@sync-erp/database';

export class RentalAvailabilityService {
  async getSchedulerTimeline(
    companyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    items: Array<{
      id: string;
      name: string;
      units: Array<{
        id: string;
        unitCode: string;
        status: string;
        bookings: Array<{
          orderId: string;
          orderNumber: string;
          partnerName: string;
          startDate: Date;
          endDate: Date;
          status: string;
        }>;
      }>;
    }>;
  }> {
    // Fetch rental items with units
    const items = await prisma.rentalItem.findMany({
      where: { companyId },
      include: {
        product: { select: { name: true } },
        units: {
          orderBy: { unitCode: 'asc' },
        },
      },
    });

    // Fetch orders that overlap with the date range
    const orders = await prisma.rentalOrder.findMany({
      where: {
        companyId,
        status: {
          in: [RentalOrderStatus.CONFIRMED, RentalOrderStatus.ACTIVE],
        },
        OR: [
          {
            rentalStartDate: { lte: endDate },
            rentalEndDate: { gte: startDate },
          },
        ],
      },
      include: {
        partner: { select: { name: true } },
        unitAssignments: {
          select: { rentalItemUnitId: true },
        },
      },
    });

    // Create a map of unit -> bookings
    const unitBookings = new Map<
      string,
      Array<{
        orderId: string;
        orderNumber: string;
        partnerName: string;
        startDate: Date;
        endDate: Date;
        status: string;
      }>
    >();

    for (const order of orders) {
      for (const assignment of order.unitAssignments) {
        const unitId = assignment.rentalItemUnitId;
        if (!unitBookings.has(unitId)) {
          unitBookings.set(unitId, []);
        }
        unitBookings.get(unitId)!.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          partnerName: order.partner?.name || 'Unknown',
          startDate: order.rentalStartDate,
          endDate: order.rentalEndDate,
          status: order.status,
        });
      }
    }

    // Build the response
    return {
      items: items.map((item) => ({
        id: item.id,
        name: item.product?.name || 'Unknown',
        units: item.units.map((unit) => ({
          id: unit.id,
          unitCode: unit.unitCode,
          status: unit.status,
          bookings: unitBookings.get(unit.id) || [],
        })),
      })),
    };
  }
}
