import { z } from 'zod';
import { isInternalStaff } from '../../constants/staff.js';
import { getWhatsAppConfig } from '../../config.js';
import { normalizePhone } from '@sync-erp/shared/whatsapp';
import { getRedisClient } from './redis-client.js';

export const SESSION_MODE_ESCALATION_TTL = 1800; // 30 minutes
export const LAST_ESCALATION_KEY_PREFIX = 'whatsapp:last_escalation:';
export const LAST_ESCALATION_TTL = 86400; // 24 hours

export const EscalateArgsSchema = z.object({
  customerPhone: z.string().min(1),
  customerName: z.string().min(1),
  productInterest: z.string().min(1),
  escalationReason: z.string().min(1),
  leadSummary: z.string().min(1),
  urgencyLevel: z.enum(['low', 'medium', 'high', 'critical']),
});

export const EscalatedLeadPayloadSchema = z.object({
  customerPhone: z.string(),
  customerName: z.string(),
  productInterest: z.string(),
  escalationReason: z.string(),
  leadSummary: z.string(),
  urgencyLevel: z.enum(['low', 'medium', 'high', 'critical']),
  escalatedAt: z.string(),
});

export type EscalatedLeadPayload = z.infer<typeof EscalatedLeadPayloadSchema>;

export const TelegramErrorResponseSchema = z.object({
  ok: z.boolean(),
  description: z.string().optional(),
  error_code: z.number().optional(),
});

export type EscalationCategory = 'payment' | 'schedule' | 'discount' | 'b2b' | 'complaint' | 'general';

export function detectEscalationCategory(reason: string, summary: string): EscalationCategory {
  const text = `${reason} ${summary}`.toLowerCase();
  if (
    text.includes('bayar') ||
    text.includes('transfer') ||
    text.includes('bukti') ||
    text.includes('qris') ||
    text.includes('mutasi') ||
    text.includes('dp')
  ) {
    return 'payment';
  }
  if (
    text.includes('jadwal') ||
    text.includes('slot') ||
    text.includes('jam pengantaran') ||
    text.includes('siang') ||
    text.includes('armada')
  ) {
    return 'schedule';
  }
  if (
    text.includes('diskon') ||
    text.includes('nego') ||
    text.includes('potongan') ||
    text.includes('tawar')
  ) {
    return 'discount';
  }
  if (
    text.includes('partai') ||
    text.includes('b2b') ||
    text.includes('stok kurang') ||
    text.includes('habis')
  ) {
    return 'b2b';
  }
  if (
    text.includes('komplain') ||
    text.includes('frustrasi') ||
    text.includes('marah') ||
    text.includes('manusia')
  ) {
    return 'complaint';
  }
  return 'general';
}

export function buildLeadCard(params: z.infer<typeof EscalateArgsSchema>): string {
  const urgencyEmoji: Record<string, string> = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    critical: '🔴',
  };
  const emoji = urgencyEmoji[params.urgencyLevel] ?? '⚪';
  const category = detectEscalationCategory(params.escalationReason, params.leadSummary);

  let title = '🚨 ESKALASI LEAD MASUK';
  let actionHints: string[] = [
    '• Berikan instruksi langsung (misal diskon / jadwal)',
    '• "Take over" → saya mute, kamu handle langsung',
  ];

  if (category === 'payment') {
    title = '💳 KONFIRMASI PEMBAYARAN DP';
    actionHints = [
      '• "acc bayar" / "sudah masuk" → saya konfirmasi booking sah ke customer',
      '• "belum masuk" → saya minta customer cek transaksi/mutasi',
      '• "Take over" → saya mute, kamu handle langsung',
    ];
  } else if (category === 'schedule') {
    title = '🚚 REQUEST JADWAL KHUSUS ARMADA';
    actionHints = [
      '• "acc jam [X]" / "bisa" → saya set jadwal & infokan ke customer',
      '• "tolak" → saya tolak santun & arahkan ke slot normal (pagi/sore)',
      '• "Take over" → saya mute, kamu handle langsung',
    ];
  } else if (category === 'discount') {
    title = '🏷️ PENGAJUAN DISKON / NEGO HARGA';
    actionHints = [
      '• "Kasih diskon [X]%" / "acc" → saya update harga & WA customer',
      '• "tolak" → saya tolak santun & pertahankan harga normal',
      '• "Take over" → saya mute, kamu handle langsung',
    ];
  } else if (category === 'b2b') {
    title = '📦 PERMINTAAN PARTAI BESAR / STOK KURANG';
    actionHints = [
      '• Berikan arahan solusi stok / vendor luar',
      '• "Take over" → saya mute, kamu handle langsung',
    ];
  } else if (category === 'complaint') {
    title = '⚠️ ESKALASI CS / KOMPLAIN PELANGGAN';
    actionHints = [
      '• "Take over" → saya mute, kamu handle langsung',
      '• Berikan pesan penengah untuk disampaikan ke customer',
    ];
  }

  return [
    title,
    '──────────────────────────',
    `👤 Nama: ${params.customerName}`,
    `📱 WA: ${params.customerPhone}`,
    `🎯 Minat: ${params.productInterest}`,
    `⏱️ Urgensi: ${emoji} ${params.urgencyLevel.toUpperCase()}`,
    '',
    '⚠️ Alasan Eskalasi:',
    params.escalationReason,
    '',
    '💡 Ringkasan:',
    params.leadSummary,
    '──────────────────────────',
    'Reply ke saya untuk:',
    ...actionHints,
  ].join('\n');
}

export async function handleEscalateToOwner(args: Record<string, unknown>): Promise<string> {
  const parsed = EscalateArgsSchema.safeParse(args);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`Invalid escalate_to_owner args: ${issues}`);
  }

  const params = parsed.data;

  if (isInternalStaff(params.customerPhone)) {
    throw new Error(
      `Cannot escalate internal staff or store conversation to owner: ${params.customerPhone}`
    );
  }

  const config = getWhatsAppConfig();
  const token = config.raraTelegramBotToken.trim();
  if (!token) {
    throw new Error('RARA_TELEGRAM_BOT_TOKEN is not configured');
  }

  const DON_CHAT_ID = '8215203590';
  const text = buildLeadCard(params);

  const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: DON_CHAT_ID,
      text,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!tgRes.ok) {
    const rawErr: unknown = await tgRes.json().catch(() => null);
    const parsedErr = TelegramErrorResponseSchema.safeParse(rawErr);
    const errText = parsedErr.success && parsedErr.data.description
      ? parsedErr.data.description
      : `HTTP ${tgRes.status}`;
    throw new Error(`Telegram sendMessage failed: ${errText}`);
  }

  // Auto-mute: set session_mode = HUMAN for 30 minutes
  const normalizedPhone = normalizePhone(params.customerPhone);
  const redis = getRedisClient();
  await redis.set(
    `whatsapp:session_mode:${normalizedPhone}`,
    'HUMAN',
    'EX',
    SESSION_MODE_ESCALATION_TTL,
  );

  // Save escalated lead to Redis key: whatsapp:last_escalation:${DON_CHAT_ID} with TTL 1 hour
  const escalationPayload: EscalatedLeadPayload = {
    customerPhone: normalizedPhone,
    customerName: params.customerName,
    productInterest: params.productInterest,
    escalationReason: params.escalationReason,
    leadSummary: params.leadSummary,
    urgencyLevel: params.urgencyLevel,
    escalatedAt: new Date().toISOString(),
  };
  await redis.set(
    `${LAST_ESCALATION_KEY_PREFIX}${DON_CHAT_ID}`,
    JSON.stringify(escalationPayload),
    'EX',
    LAST_ESCALATION_TTL,
  );

  return JSON.stringify({
    success: true,
    customerPhone: normalizedPhone,
    notifiedDon: true,
    autoMutedFor: SESSION_MODE_ESCALATION_TTL,
    lastEscalationSaved: true,
  });
}

export const GetLastEscalatedLeadArgsSchema = z.object({
  chatId: z.string().optional(),
});

export async function handleGetLastEscalatedLead(args: Record<string, unknown>): Promise<string> {
  const parsed = GetLastEscalatedLeadArgsSchema.safeParse(args);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`Invalid get_last_escalated_lead args: ${issues}`);
  }

  const chatId = parsed.data.chatId?.trim() || '8215203590';
  const redis = getRedisClient();
  const raw = await redis.get(`${LAST_ESCALATION_KEY_PREFIX}${chatId}`);
  if (!raw) {
    return JSON.stringify({
      found: false,
      message: `No active escalated lead found for chat ID ${chatId} (or lead expired after 1 hour).`,
    });
  }

  try {
    const rawJson: unknown = JSON.parse(raw);
    const leadParsed = EscalatedLeadPayloadSchema.safeParse(rawJson);
    if (!leadParsed.success) {
      return JSON.stringify({
        found: false,
        error: 'Corrupted escalation payload in Redis',
      });
    }

    return JSON.stringify({
      found: true,
      lead: leadParsed.data,
    });
  } catch {
    return JSON.stringify({
      found: false,
      error: 'Failed to parse escalation payload in Redis',
    });
  }
}
