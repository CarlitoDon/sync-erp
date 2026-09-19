import {
  prisma as defaultPrisma,
  RentalOrderStatus,
  RentalPaymentStatus,
  ReturnStatus,
} from '@sync-erp/database';
import {
  RentalAdminTaskItem,
  RentalAdminTaskQueueResponse,
  GetRentalAdminTasksInput,
  RentalTaskUrgency,
  RentalAdminSuggestedAction,
} from '@sync-erp/shared';

function getDaysDiff(targetDate: Date, baseDate: Date): number {
  const t = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate()
  ).getTime();
  const b = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate()
  ).getTime();
  return Math.round((t - b) / (1000 * 60 * 60 * 24));
}

function formatCurrencyIdr(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

export class RentalAdminTaskService {
  constructor(private readonly prisma: typeof defaultPrisma = defaultPrisma) {}

  async getAdminTaskQueue(
    companyId: string,
    input?: GetRentalAdminTasksInput
  ): Promise<RentalAdminTaskQueueResponse> {
    const refDate = input?.referenceDate
      ? new Date(input.referenceDate)
      : new Date();

    // Fetch active, confirmed, and draft orders
    const orders = await this.prisma.rentalOrder.findMany({
      where: {
        companyId,
        status: {
          in: [
            RentalOrderStatus.DRAFT,
            RentalOrderStatus.CONFIRMED,
            RentalOrderStatus.ACTIVE,
          ],
        },
      },
      include: {
        partner: true,
        items: {
          include: {
            rentalItem: {
              include: { product: true },
            },
            rentalBundle: true,
          },
        },
        deposit: true,
      },
      orderBy: {
        rentalStartDate: 'asc',
      },
    });

    // Fetch draft returns
    const draftReturns = await this.prisma.rentalReturn.findMany({
      where: {
        companyId,
        settlementStatus: ReturnStatus.DRAFT,
      },
      include: {
        rentalOrder: {
          include: {
            partner: true,
          },
        },
      },
    });

    const draftReturnOrderIds = new Set(
      draftReturns.map((r) => r.rentalOrderId)
    );

    const allTasks: RentalAdminTaskItem[] = [];

    for (const order of orders) {
      const partnerName = order.partner?.name || 'Customer';
      const partnerPhone = order.partner?.phone || null;
      const total = Number(order.totalAmount || 0);
      const deposit = Number(order.depositAmount || 0);
      const remaining = Math.max(0, total - deposit);

      // Build items summary
      const itemsSummary =
        order.items && order.items.length > 0
          ? order.items
              .map((i) => {
                const name =
                  i.rentalBundle?.shortName ||
                  i.rentalBundle?.name ||
                  i.rentalItem?.product?.name ||
                  'Item';
                return `${i.quantity}x ${name}`;
              })
              .join(', ')
          : 'Tidak ada rincian item';

      // 1. Task: DRAFT order needing confirmation & DP
      if (order.status === RentalOrderStatus.DRAFT) {
        const daysDiff = getDaysDiff(new Date(order.rentalStartDate), refDate);
        let urgency: RentalTaskUrgency = 'UPCOMING';
        if (daysDiff < 0) {
          urgency = 'OVERDUE';
        } else if (daysDiff === 0) {
          urgency = 'TODAY';
        }

        allTasks.push({
          id: `task-${order.id}-confirm`,
          orderId: order.id,
          orderNumber: order.orderNumber,
          partnerId: order.partnerId,
          customerName: partnerName,
          customerPhone: partnerPhone,
          taskType: 'CONFIRM_AND_DP',
          category: 'CONFIRMATION',
          urgency,
          title: `Konfirmasi Pesanan & Catat DP: ${partnerName}`,
          description: `Pesanan DRAFT (${itemsSummary}). Total ${formatCurrencyIdr(total)}. Perlu konfirmasi jadwal & alokasi unit.`,
          scheduledDate: new Date(order.rentalStartDate).toISOString(),
          daysDiff,
          orderStatus: order.status,
          paymentStatus: order.rentalPaymentStatus,
          totalAmount: total,
          depositAmount: deposit,
          remainingAmount: remaining,
          deliveryAddress: order.deliveryAddress,
          itemsSummary,
          suggestedAction: 'CONFIRM',
        });
      }

      // 2. Task: Payment awaiting verification
      if (order.rentalPaymentStatus === RentalPaymentStatus.AWAITING_CONFIRM) {
        const claimDate = order.paymentClaimedAt
          ? new Date(order.paymentClaimedAt)
          : new Date();
        const claimDiff = getDaysDiff(claimDate, refDate);
        const urgency: RentalTaskUrgency = claimDiff < 0 ? 'OVERDUE' : 'TODAY';
        allTasks.push({
          id: `task-${order.id}-verify-payment`,
          orderId: order.id,
          orderNumber: order.orderNumber,
          partnerId: order.partnerId,
          customerName: partnerName,
          customerPhone: partnerPhone,
          taskType: 'VERIFY_PAYMENT',
          category: 'CONFIRMATION',
          urgency,
          title: `Verifikasi Bukti Pembayaran: ${partnerName}`,
          description: `Customer telah submit konfirmasi transfer. Perlu verifikasi mutasi rekening & konfirmasi status pembayaran.`,
          scheduledDate: claimDate.toISOString(),
          daysDiff: claimDiff,
          orderStatus: order.status,
          paymentStatus: order.rentalPaymentStatus,
          totalAmount: total,
          depositAmount: deposit,
          remainingAmount: remaining,
          deliveryAddress: order.deliveryAddress,
          itemsSummary,
          suggestedAction: 'VERIFY_PAYMENT',
        });
      }

      // 3. Task: CONFIRMED order delivery dispatch (Serah Terima / Kirim)
      if (order.status === RentalOrderStatus.CONFIRMED) {
        const daysDiff = getDaysDiff(new Date(order.rentalStartDate), refDate);
        let urgency: RentalTaskUrgency = 'UPCOMING';
        if (daysDiff < 0) {
          urgency = 'OVERDUE';
        } else if (daysDiff === 0) {
          urgency = 'TODAY';
        }

        // Show dispatch tasks that are overdue, today, or in the next 3 days
        if (daysDiff <= 3) {
          allTasks.push({
            id: `task-${order.id}-delivery`,
            orderId: order.id,
            orderNumber: order.orderNumber,
            partnerId: order.partnerId,
            customerName: partnerName,
            customerPhone: partnerPhone,
            taskType: 'DELIVERY_DISPATCH',
            category: 'DELIVERY',
            urgency,
            title:
              daysDiff < 0
                ? `Pengiriman Terlambat: ${partnerName}`
                : daysDiff === 0
                  ? `Kirim & Serah Terima Hari Ini: ${partnerName}`
                  : `Persiapan Kirim (${daysDiff} hari lagi): ${partnerName}`,
            description: `Kirim ${itemsSummary} ke ${order.deliveryAddress || 'Alamat Customer'}. Lakukan cek kondisi & serah terima unit.`,
            scheduledDate: new Date(order.rentalStartDate).toISOString(),
            daysDiff,
            orderStatus: order.status,
            paymentStatus: order.rentalPaymentStatus,
            totalAmount: total,
            depositAmount: deposit,
            remainingAmount: remaining,
            deliveryAddress: order.deliveryAddress,
            itemsSummary,
            suggestedAction: 'RELEASE',
          });
        }
      }

      // 4. Task: Unsettled Pelunasan Payment
      // Exclude AWAITING_CONFIRM because customer already submitted payment proof and it's being verified
      if (
        (order.status === RentalOrderStatus.CONFIRMED ||
          order.status === RentalOrderStatus.ACTIVE) &&
        order.rentalPaymentStatus !== RentalPaymentStatus.CONFIRMED &&
        order.rentalPaymentStatus !== RentalPaymentStatus.AWAITING_CONFIRM &&
        remaining > 0
      ) {
        const startDiff = getDaysDiff(new Date(order.rentalStartDate), refDate);
        // For CONFIRMED orders, only show pelunasan if delivery is within 3 days or overdue
        if (order.status === RentalOrderStatus.ACTIVE || startDiff <= 3) {
          let urgency: RentalTaskUrgency = 'UPCOMING';
          if (startDiff < 0) {
            urgency = 'OVERDUE';
          } else if (
            startDiff === 0 ||
            order.status === RentalOrderStatus.ACTIVE
          ) {
            urgency = 'TODAY';
          }

          allTasks.push({
            id: `task-${order.id}-pelunasan`,
            orderId: order.id,
            orderNumber: order.orderNumber,
            partnerId: order.partnerId,
            customerName: partnerName,
            customerPhone: partnerPhone,
            taskType: 'PELUNASAN_PAYMENT',
            category: 'PELUNASAN',
            urgency,
            title: `Tagihan Pelunasan (${formatCurrencyIdr(remaining)}): ${partnerName}`,
            description: `Total sewa ${formatCurrencyIdr(total)}, DP masuk ${formatCurrencyIdr(deposit)}. Sisa pelunasan ${formatCurrencyIdr(remaining)} belum dibayar.`,
            scheduledDate: new Date(order.rentalStartDate).toISOString(),
            daysDiff: startDiff,
            orderStatus: order.status,
            paymentStatus: order.rentalPaymentStatus,
            totalAmount: total,
            depositAmount: deposit,
            remainingAmount: remaining,
            deliveryAddress: order.deliveryAddress,
            itemsSummary,
            suggestedAction: 'RECORD_PELUNASAN',
          });
        }
      }

      // 5. Task: ACTIVE order pickup & return due
      // Only include active orders that don't already have a return draft created, and due within 3 days or overdue
      if (
        order.status === RentalOrderStatus.ACTIVE &&
        !draftReturnOrderIds.has(order.id)
      ) {
        const daysDiff = getDaysDiff(new Date(order.rentalEndDate), refDate);

        // Show pickup tasks that are overdue, today, or in the next 3 days
        if (daysDiff <= 3) {
          let urgency: RentalTaskUrgency = 'UPCOMING';
          let suggestedAction: RentalAdminSuggestedAction = 'PROCESS_RETURN';

          if (daysDiff < 0) {
            urgency = 'OVERDUE';
            suggestedAction = 'EXTEND';
          } else if (daysDiff === 0) {
            urgency = 'TODAY';
            suggestedAction = 'PROCESS_RETURN';
          }

          allTasks.push({
            id: `task-${order.id}-pickup`,
            orderId: order.id,
            orderNumber: order.orderNumber,
            partnerId: order.partnerId,
            customerName: partnerName,
            customerPhone: partnerPhone,
            taskType: 'PICKUP_RETURN',
            category: 'PICKUP',
            urgency,
            title:
              daysDiff < 0
                ? `Pengembalian Overdue (${Math.abs(daysDiff)} hari lewat): ${partnerName}`
                : daysDiff === 0
                  ? `Jemput Unit Hari Ini: ${partnerName}`
                  : `Jadwal Jemput (${daysDiff} hari lagi): ${partnerName}`,
            description: `Sewa ${itemsSummary} selesai pada ${new Date(order.rentalEndDate).toLocaleDateString('id-ID')}. Siapkan armada penjemputan atau tawarkan perpanjangan.`,
            scheduledDate: new Date(order.rentalEndDate).toISOString(),
            daysDiff,
            orderStatus: order.status,
            paymentStatus: order.rentalPaymentStatus,
            totalAmount: total,
            depositAmount: deposit,
            remainingAmount: remaining,
            deliveryAddress: order.deliveryAddress,
            itemsSummary,
            suggestedAction,
          });
        }
      }
    }

    // 6. Task: Draft returns needing inspection & deposit refund
    for (const ret of draftReturns) {
      const partnerName = ret.rentalOrder.partner?.name || 'Customer';
      const partnerPhone = ret.rentalOrder.partner?.phone || null;
      const returnedDate = new Date(ret.returnedAt);
      const retDiff = getDaysDiff(returnedDate, refDate);
      const urgency: RentalTaskUrgency = retDiff < -1 ? 'OVERDUE' : 'TODAY';

      allTasks.push({
        id: `task-return-${ret.id}`,
        orderId: ret.rentalOrderId,
        orderNumber: ret.rentalOrder.orderNumber,
        partnerId: ret.rentalOrder.partnerId,
        customerName: partnerName,
        customerPhone: partnerPhone,
        taskType: 'SETTLE_RETURN',
        category: 'RETURN',
        urgency,
        title: `Selesaikan Pemeriksaan & Deposit Retur: ${partnerName}`,
        description: `Barang telah diterima kembali (${returnedDate.toLocaleDateString('id-ID')}). Form retur DRAFT perlu difinalisasi untuk pencatatan denda/kerusakan dan pengembalian sisa deposit.`,
        scheduledDate: returnedDate.toISOString(),
        daysDiff: retDiff,
        orderStatus: ret.rentalOrder.status,
        paymentStatus: ret.rentalOrder.rentalPaymentStatus,
        totalAmount: Number(ret.rentalOrder.totalAmount || 0),
        depositAmount: Number(ret.rentalOrder.depositAmount || 0),
        remainingAmount: 0,
        deliveryAddress: ret.rentalOrder.deliveryAddress,
        itemsSummary: 'Barang dalam proses retur',
        suggestedAction: 'SETTLE_RETURN',
      });
    }

    // Sort order:
    // 1. Urgency: OVERDUE -> TODAY -> UPCOMING
    // 2. DaysDiff ascending (most urgent first)
    const urgencyWeight: Record<RentalTaskUrgency, number> = {
      OVERDUE: 0,
      TODAY: 1,
      UPCOMING: 2,
    };

    allTasks.sort((a, b) => {
      const wDiff = urgencyWeight[a.urgency] - urgencyWeight[b.urgency];
      if (wDiff !== 0) return wDiff;
      return a.daysDiff - b.daysDiff;
    });

    // Calculate complete summary metrics before any category/urgency filters
    const summary = {
      totalPendingTasks: allTasks.length,
      overdueCount: allTasks.filter((t) => t.urgency === 'OVERDUE').length,
      todayCount: allTasks.filter((t) => t.urgency === 'TODAY').length,
      upcomingCount: allTasks.filter((t) => t.urgency === 'UPCOMING').length,
      byCategory: {
        confirmationCount: allTasks.filter((t) => t.category === 'CONFIRMATION')
          .length,
        deliveryCount: allTasks.filter((t) => t.category === 'DELIVERY').length,
        pelunasanCount: allTasks.filter((t) => t.category === 'PELUNASAN')
          .length,
        pickupCount: allTasks.filter((t) => t.category === 'PICKUP').length,
        returnSettlementCount: allTasks.filter((t) => t.category === 'RETURN')
          .length,
      },
    };

    // Apply filtering
    let filteredTasks = allTasks;

    if (input?.category && input.category !== 'ALL') {
      filteredTasks = filteredTasks.filter((t) => t.category === input.category);
    }

    if (input?.urgency && input.urgency !== 'ALL') {
      filteredTasks = filteredTasks.filter((t) => t.urgency === input.urgency);
    }

    return {
      summary,
      tasks: filteredTasks,
    };
  }
}
