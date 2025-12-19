import { prisma, InvoiceStatus } from '@sync-erp/database';
import { DashboardKPIs } from '@sync-erp/shared';

/**
 * Dashboard Service - Business logic for dashboard KPI aggregation.
 * Part of Phase 1 Dashboard KPIs (US1).
 *
 * Per FR-001: Provides Total Sales, Outstanding AR, Outstanding AP, Inventory Value.
 * Per FR-002: Data is refreshed on page load (no auto-refresh).
 */
export class DashboardService {
  /**
   * Get aggregated KPIs for the dashboard.
   *
   * - totalSales: Sum of posted/paid invoice amounts
   * - outstandingAR: Sum of invoice balances > 0
   * - outstandingAP: Sum of bill balances > 0
   * - inventoryValue: Sum of (stock qty × average cost) from products
   */
  async getKPIs(companyId: string): Promise<DashboardKPIs> {
    // Run all aggregations in parallel for better performance
    const [
      totalSalesResult,
      outstandingARResult,
      outstandingAPResult,
      inventoryValueResult,
    ] = await Promise.all([
      this.getTotalSales(companyId),
      this.getOutstandingAR(companyId),
      this.getOutstandingAP(companyId),
      this.getInventoryValue(companyId),
    ]);

    return {
      totalSales: totalSalesResult,
      outstandingAR: outstandingARResult,
      outstandingAP: outstandingAPResult,
      inventoryValue: inventoryValueResult,
      currency: 'IDR', // TODO: Get from company settings
    };
  }

  /**
   * Total Sales: Sum of posted and paid invoice amounts (INVOICE type only).
   */
  private async getTotalSales(companyId: string): Promise<number> {
    const result = await prisma.invoice.aggregate({
      where: {
        companyId,
        type: 'INVOICE', // Only sales invoices, not bills or credit notes
        status: {
          in: [InvoiceStatus.POSTED, InvoiceStatus.PAID],
        },
      },
      _sum: {
        amount: true, // Total amount field
      },
    });

    return result._sum?.amount?.toNumber() ?? 0;
  }

  /**
   * Outstanding AR: Sum of invoice balances where balance > 0 (INVOICE type only).
   */
  private async getOutstandingAR(companyId: string): Promise<number> {
    const result = await prisma.invoice.aggregate({
      where: {
        companyId,
        type: 'INVOICE', // Only sales invoices for AR
        status: InvoiceStatus.POSTED,
        balance: {
          gt: 0,
        },
      },
      _sum: {
        balance: true,
      },
    });

    return result._sum?.balance?.toNumber() ?? 0;
  }

  /**
   * Outstanding AP: Sum of invoice balances where balance > 0 (BILL type only).
   * Note: Bills are stored in Invoice table with type = 'BILL'
   */
  private async getOutstandingAP(companyId: string): Promise<number> {
    const result = await prisma.invoice.aggregate({
      where: {
        companyId,
        type: 'BILL', // Bills for AP
        status: InvoiceStatus.POSTED,
        balance: {
          gt: 0,
        },
      },
      _sum: {
        balance: true,
      },
    });

    return result._sum?.balance?.toNumber() ?? 0;
  }

  /**
   * Inventory Value: Sum of (stockQty × averageCost) for all products.
   * Note: Using Product.stockQty and Product.averageCost since InventoryItem doesn't exist
   */
  private async getInventoryValue(
    companyId: string
  ): Promise<number> {
    const products = await prisma.product.findMany({
      where: {
        companyId,
        isService: false, // Only physical products
      },
      select: {
        stockQty: true,
        averageCost: true,
      },
    });

    // Calculate total inventory value
    let totalValue = 0;
    for (const product of products) {
      const qty = product.stockQty;
      const avgCost = product.averageCost?.toNumber() ?? 0;
      totalValue += qty * avgCost;
    }

    return totalValue;
  }
}
