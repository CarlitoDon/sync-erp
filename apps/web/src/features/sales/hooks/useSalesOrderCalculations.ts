import { useMemo } from 'react';
import { InvoiceStatusSchema } from '@sync-erp/shared';
import { RouterOutputs } from '@/lib/trpc';

type SalesOrder = RouterOutputs['salesOrder']['getById'];

export function useSalesOrderCalculations(
  order: SalesOrder | undefined | null
) {
  return useMemo(() => {
    if (!order) {
      return {
        totalAmount: 0,
        totalInvoiced: 0,
        outstandingAmount: 0,
        dpAmount: 0,
        dpPercent: 0,
        isDpPaid: false,
        depositSummary: null,
        dpInvoice: undefined,
      };
    }

    const totalAmount = Number(order.totalAmount);

    // Calculate total invoiced amount (excluding DP invoices to avoid double counting if they are handled separately,
    // but typically we want to know total invoiced. The original code excluded DP for "Total Invoiced" display
    // but subtracted both for "Outstanding".)
    // Original logic:
    // Total Invoiced = sum(invoices where !isDownPayment)
    // Outstanding = Total - (sum(invoices where !isDownPayment) - dpAmount) -> This seems weird in original code.
    // Let's stick to the original logic for now to maintain behavior, but clean it up.

    const nonDpInvoicesTotal =
      order.invoices?.reduce((sum, inv) => {
        return inv.isDownPayment
          ? sum
          : sum + Number(inv.subtotal || 0);
      }, 0) || 0;

    const dpAmount = order.dpAmount ? Number(order.dpAmount) : 0;
    const dpPercent = order.dpPercent ? Number(order.dpPercent) : 0;

    // Check if DP invoice exists and is paid
    const dpInvoice = order.invoices?.find((inv) =>
      inv.notes?.includes('Down Payment')
    );
    const isDpPaid =
      dpInvoice?.status === InvoiceStatusSchema.enum.PAID;

    // Original outstanding logic:
    // Math.max(0, totalAmount - nonDpInvoicesTotal - dpAmount)
    // This implies dpAmount is considered "paid" or "covered" separately?
    // Actually, usually Outstanding = Total - Paid.
    // But the original code was: Total - TotalInvoiced(NonDP) - DPAmount.
    const outstandingAmount = Math.max(
      0,
      totalAmount - nonDpInvoicesTotal - dpAmount
    );

    return {
      totalAmount,
      totalInvoiced: nonDpInvoicesTotal,
      outstandingAmount,
      dpAmount,
      dpPercent,
      isDpPaid,
      dpInvoice,
    };
  }, [order]);
}

export type SalesOrderCalculations = ReturnType<
  typeof useSalesOrderCalculations
>;
