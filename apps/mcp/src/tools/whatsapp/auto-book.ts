import { z } from 'zod';
import { normalizePhone } from '@sync-erp/shared/whatsapp';
import { apiQuery, apiMutation } from '../../client.js';
import { getWhatsAppConfig } from '../../config.js';
import { getRedisClient } from './redis-client.js';
import {
  LAST_ESCALATION_KEY_PREFIX,
  EscalatedLeadPayloadSchema,
} from './escalation.js';

export const RentalOrderAutoBookLeadArgsSchema = z.object({
  companyId: z.string().uuid().default('04d0ed88-0db8-4641-b98b-101728cd0caa'),
  chatId: z.string().optional(),
  customerPhone: z.string().optional(),
  customerName: z.string().optional(),
  rentalStartDate: z.string().optional(),
  rentalEndDate: z.string().optional(),
  bundleSize: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  deliveryFee: z.number().nonnegative().optional(),
  deliveryAddress: z.string().optional(),
  notes: z.string().optional(),
  paymentReference: z.string().optional(),
});

export const MONTH_MAP: Record<string, string> = {
  januari: '01', jan: '01', februari: '02', feb: '02', maret: '03', mar: '03',
  april: '04', apr: '04', mei: '05', juni: '06', jun: '06', juli: '07', jul: '07',
  agustus: '08', agu: '08', ags: '08', september: '09', sept: '09', sep: '09',
  oktober: '10', okt: '10', november: '11', nov: '11', desember: '12', des: '12',
};

export function extractLeadDetails(leadSummary: string, productInterest: string) {
  const full = `${productInterest} ${leadSummary}`.toLowerCase();

  let bundleSize = '90';
  for (const s of ['180', '160', '120', '100', '90']) {
    if (full.includes(s)) {
      bundleSize = s;
      break;
    }
  }

  const qtyMatch = full.match(/(\d+)\s*(?:unit|pcs|kasur)/);
  const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;

  const feeMatch = full.match(/ongkir[^\d]*(\d{1,3}(?:\.\d{3})+|\d+)/);
  let deliveryFee = 0;
  if (feeMatch) {
    deliveryFee = parseInt(feeMatch[1].replace(/\./g, ''), 10);
  }

  let startDate = '';
  let endDate = '';
  const datePattern = /(\d{1,2})\s*(?:[A-Za-z]+)?\s*[-–]\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/;
  const m = full.match(datePattern);
  if (m) {
    const d1 = m[1].padStart(2, '0');
    const d2 = m[2].padStart(2, '0');
    const monthStr = m[3].toLowerCase();
    const year = m[4];
    const monthNum = MONTH_MAP[monthStr] || '09';
    startDate = `${year}-${monthNum}-${d1}`;
    endDate = `${year}-${monthNum}-${d2}`;
  }

  let deliveryAddress = 'Yogyakarta';
  const addrMatch = leadSummary.match(/di\s+([^.,\n]+)/i);
  if (addrMatch) {
    deliveryAddress = addrMatch[1].trim();
  }

  let notes = '';
  const notesMatch = leadSummary.match(/(?:pengantaran|slot)[^.]+/i);
  if (notesMatch) {
    notes = notesMatch[0].trim();
  }

  return {
    bundleSize,
    quantity,
    deliveryFee,
    startDate,
    endDate,
    deliveryAddress,
    notes,
  };
}

export const PartnerListResponseSchema = z.array(z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable().optional(),
}));

export const BundleListResponseSchema = z.array(z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string().nullable().optional(),
  dailyRate: z.string().or(z.number()),
}));

export const OrderResponseSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  totalAmount: z.string().or(z.number()),
  status: z.string(),
});

export const PartnerResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export async function handleRentalOrderAutoBookLead(args: Record<string, unknown>): Promise<string> {
  const parsed = RentalOrderAutoBookLeadArgsSchema.safeParse(args);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`Invalid rental_order_auto_book_lead args: ${issues}`);
  }

  const companyId = parsed.data.companyId;
  const chatId = parsed.data.chatId?.trim() || '8215203590';
  const redis = getRedisClient();
  const rawLead = await redis.get(`${LAST_ESCALATION_KEY_PREFIX}${chatId}`);

  let leadPayload: z.infer<typeof EscalatedLeadPayloadSchema> | null = null;
  if (rawLead) {
    try {
      const jsonLead: unknown = JSON.parse(rawLead);
      const parsedLead = EscalatedLeadPayloadSchema.safeParse(jsonLead);
      if (parsedLead.success) {
        leadPayload = parsedLead.data;
      }
    } catch {
      // non-fatal
    }
  }

  const extracted = leadPayload ? extractLeadDetails(leadPayload.leadSummary, leadPayload.productInterest) : null;

  const rawPhone = parsed.data.customerPhone || leadPayload?.customerPhone || '';
  const customerPhone = normalizePhone(rawPhone);
  if (!customerPhone) {
    throw new Error('Customer phone could not be resolved from args or last escalation lead.');
  }

  const customerName = parsed.data.customerName || leadPayload?.customerName || 'Pelanggan Santi Living';
  const bundleSize = parsed.data.bundleSize || extracted?.bundleSize || '90';
  const quantity = parsed.data.quantity ?? extracted?.quantity ?? 1;
  const deliveryFee = parsed.data.deliveryFee ?? extracted?.deliveryFee ?? 0;
  const deliveryAddress = parsed.data.deliveryAddress || extracted?.deliveryAddress || 'Yogyakarta';
  const notes = parsed.data.notes || extracted?.notes || 'Pesanan dari WhatsApp';
  const startDate = parsed.data.rentalStartDate || extracted?.startDate || '';
  const endDate = parsed.data.rentalEndDate || extracted?.endDate || '';
  const paymentRef = parsed.data.paymentReference || 'QRIS-DP';

  if (!startDate || !endDate) {
    throw new Error(`Rental dates could not be determined. startDate='${startDate}', endDate='${endDate}'`);
  }

  // 1. Partner lookup or creation
  const partnersRaw = await apiQuery('partner.list', {}, companyId);
  const parsedPartners = PartnerListResponseSchema.safeParse(partnersRaw);
  let partnerId: string | null = null;
  if (parsedPartners.success) {
    for (const p of parsedPartners.data) {
      if (p.phone && normalizePhone(p.phone) === customerPhone) {
        partnerId = p.id;
        break;
      }
    }
  }

  if (!partnerId) {
    const newPartnerRaw = await apiMutation('partner.create', {
      name: customerName,
      type: 'CUSTOMER',
      phone: customerPhone,
      address: deliveryAddress,
    }, companyId);
    const parsedNewPartner = PartnerResponseSchema.safeParse(newPartnerRaw);
    if (parsedNewPartner.success) {
      partnerId = parsedNewPartner.data.id;
    } else {
      throw new Error('Failed to create customer partner in Sync ERP');
    }
  }

  // 2. Resolve rental bundle
  const bundlesRaw = await apiQuery('rental.bundles.list', {}, companyId);
  const parsedBundles = BundleListResponseSchema.safeParse(bundlesRaw);
  let bundleId: string | null = null;
  let bundleName = `Paket ${bundleSize}`;
  let pricePerDay = 35000;
  if (parsedBundles.success) {
    for (const b of parsedBundles.data) {
      const name = (b.shortName || b.name).toLowerCase();
      if (name.includes(bundleSize)) {
        bundleId = b.id;
        bundleName = b.shortName || b.name;
        pricePerDay = Number(b.dailyRate) || 35000;
        break;
      }
    }
  }

  if (!bundleId) {
    throw new Error(`Rental bundle not found for size: ${bundleSize}`);
  }

  // 3. Create Rental Order
  const startIso = startDate.includes('T') ? startDate : `${startDate}T00:00:00.000Z`;
  const endIso = endDate.includes('T') ? endDate : `${endDate}T00:00:00.000Z`;

  const orderRaw = await apiMutation('rental.orders.create', {
    partnerId,
    rentalStartDate: startIso,
    rentalEndDate: endIso,
    items: [
      {
        rentalBundleId: bundleId,
        quantity,
        pricePerDay,
      },
    ],
    deliveryFee,
    deliveryAddress,
    notes,
  }, companyId);

  const parsedOrder = OrderResponseSchema.safeParse(orderRaw);
  if (!parsedOrder.success) {
    throw new Error(`Rental order creation failed in Sync ERP: ${JSON.stringify(orderRaw)}`);
  }

  const orderId = parsedOrder.data.id;
  const orderNumber = parsedOrder.data.orderNumber;
  const totalAmount = String(parsedOrder.data.totalAmount);

  // 4. Confirm Rental Order
  await apiMutation('rental.orders.confirm', { orderId }, companyId);

  // 5. Verify DP Payment
  await apiMutation('rental.orders.verifyPayment', {
    orderId,
    action: 'confirm',
    paymentReference: paymentRef,
  }, companyId);

  // 6. Return bot to BOT mode & set note
  await redis.del(`whatsapp:session_mode:${customerPhone}`);
  await redis.del(`whatsapp:session_mute:${customerPhone}`);
  await redis.set(
    `whatsapp:customer_note:${customerPhone}`,
    `Order terkonfirmasi di Sync ERP: ${orderNumber} (${orderId}), DP verified.`
  );

  // 7. Send WhatsApp confirmation message to customer
  let waSent = false;
  try {
    const config = getWhatsAppConfig();
    const waText = [
      'alhamdulillah, pembayaran DP sudah kami terima dan diverifikasi yaa kak 😊🙏',
      '---',
      `pesanan kasur kakak sudah resmi ter-booking (*${orderNumber}*) dan terjadwal di armada kami 👍\n\nnanti armada kami akan menghubungi kakak sebelum keberangkatan pengantaran yaa. terima kasih banyak kak! ✨\n\n-r`,
    ].join('\n');

    const res = await fetch(`${config.botUrl}/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.botSecret}`,
        'X-Bot-Secret': config.botSecret,
      },
      body: JSON.stringify({
        phone: customerPhone,
        message: waText,
      }),
      signal: AbortSignal.timeout(10000),
    });
    waSent = res.ok;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[rental_order_auto_book_lead] Error sending WA confirmation:', err);
  }

  return JSON.stringify({
    success: true,
    orderNumber,
    orderId,
    partnerName: customerName,
    customerPhone,
    bundleName,
    quantity,
    rentalStartDate: startDate,
    rentalEndDate: endDate,
    deliveryFee,
    totalAmount,
    orderStatus: 'CONFIRMED',
    paymentStatus: 'CONFIRMED',
    whatsappConfirmationSent: waSent,
  });
}
