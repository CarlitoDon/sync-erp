/**
 * WhatsApp Sales Bot Tools
 *
 * Tools for the Rara WhatsApp AI Sales Bot:
 *  - whatsapp_send_message: Send a WhatsApp message via apps/bot HTTP endpoint
 *  - estimate_delivery_fee: Calculate delivery fee via Google Routes + Places APIs
 *  - set_customer_note: Store per-customer owner notes in Redis
 *  - escalate_to_owner: Send structured lead card to Don via Telegram + auto-mute
 *  - manage_customer_whitelist: Manage allowed phones in Redis Set
 *  - take_over_conversation: Mute bot for a phone (HUMAN mode)
 *  - return_to_bot: Unmute bot for a phone (BOT mode)
 *  - get_last_escalated_lead: Retrieve the latest customer lead escalated to owner via Telegram
 */
import type { ToolSpec } from '../types.js';
import { Redis } from 'ioredis';
import { z } from 'zod';
import { getString, getOptionalString, getOptionalNumber, companyIdProp } from './_helpers.js';
import { apiQuery, apiMutation } from '../client.js';
import { getWhatsAppConfig } from '../config.js';
import { isInternalStaff } from '../constants/staff.js';

// ---------------------------------------------------------------------------
// Redis Singleton
// ---------------------------------------------------------------------------

let sharedRedis: Redis | null = null;

function getRedisClient(): Redis {
  if (!sharedRedis) {
    const config = getWhatsAppConfig();
    sharedRedis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      family: 0,
    });
  }
  return sharedRedis;
}

import { normalizePhone, formatRaraMessageWithSignature } from '@sync-erp/shared/whatsapp';

// ---------------------------------------------------------------------------
// Delivery fee calculator (ported from santi-living)
// ---------------------------------------------------------------------------

const WAREHOUSE_LAT = -7.7673015;
const WAREHOUSE_LNG = 110.2938902;
const GOOGLE_ROUTES_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const GOOGLE_PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
const ROUTES_TIMEOUT_MS = 12000;
const PLACES_TIMEOUT_MS = 10000;
const PLACES_MAX_BIAS_RADIUS_METERS = 50_000;

const RoutesResponseSchema = z.object({
  routes: z.array(z.object({
    distanceMeters: z.number().positive(),
  })).min(1),
});

const GooglePlacesResponseSchema = z.object({
  places: z.array(z.object({
    id: z.string(),
    displayName: z.object({ text: z.string() }),
    formattedAddress: z.string(),
    location: z.object({ latitude: z.number(), longitude: z.number() }),
    addressComponents: z.array(z.object({
      longText: z.string(),
      shortText: z.string().optional(),
      types: z.array(z.string()),
    })).optional().default([]),
  })).optional().default([]),
});

export function calculateDeliveryFee(distanceKm: number): number {
  if (distanceKm <= 0) return 0;
  const ROUND_TRIPS = 4;
  const KM_PER_LITER = 10;
  const FUEL_PRICE = 10000;
  const rawFee = ((distanceKm * ROUND_TRIPS) / KM_PER_LITER) * FUEL_PRICE;
  return Math.ceil(rawFee / 1000) * 1000;
}

async function getDistanceKmFromCoords(
  destLat: number,
  destLng: number,
  apiKey: string,
): Promise<number> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ROUTES_TIMEOUT_MS);

  try {
    const response = await fetch(GOOGLE_ROUTES_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.distanceMeters',
      },
      body: JSON.stringify({
        origin: {
          location: { latLng: { latitude: WAREHOUSE_LAT, longitude: WAREHOUSE_LNG } },
        },
        destination: {
          location: { latLng: { latitude: destLat, longitude: destLng } },
        },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_UNAWARE',
        languageCode: 'id-ID',
        units: 'METRIC',
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Google Routes API responded with ${response.status}`);
    }

    const parsed = RoutesResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new Error('Google Routes API response is invalid');
    }

    return parsed.data.routes[0].distanceMeters / 1000;
  } finally {
    clearTimeout(timeout);
  }
}

function isDiyAddressComponent(
  components: Array<{ longText: string; shortText?: string; types: string[] }> | undefined,
): boolean {
  const province = components?.find((c) => c.types.includes('administrative_area_level_1'));
  const value = `${province?.longText ?? ''} ${province?.shortText ?? ''}`.toLowerCase();
  return value.includes('yogyakarta') || /(^|\s)diy($|\s)/.test(value);
}

async function searchPlaces(
  query: string,
  apiKey: string,
): Promise<{ lat: number; lng: number; address: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PLACES_TIMEOUT_MS);

  try {
    const response = await fetch(GOOGLE_PLACES_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': [
          'places.id',
          'places.displayName',
          'places.formattedAddress',
          'places.location',
          'places.addressComponents',
        ].join(','),
      },
      body: JSON.stringify({
        textQuery: query,
        pageSize: 5,
        languageCode: 'id',
        regionCode: 'ID',
        locationBias: {
          circle: {
            center: { latitude: WAREHOUSE_LAT, longitude: WAREHOUSE_LNG },
            radius: PLACES_MAX_BIAS_RADIUS_METERS,
          },
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Google Places API responded with ${response.status}`);
    }

    const parsed = GooglePlacesResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new Error('Google Places API response is invalid');
    }

    const places = parsed.data.places.filter((p) => isDiyAddressComponent(p.addressComponents));

    if (places.length === 0) {
      throw new Error(`No places found in DIY region for query: "${query}"`);
    }

    const first = places[0];
    return {
      lat: first.location.latitude,
      lng: first.location.longitude,
      address: first.formattedAddress,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Resolve a Google Maps short URL (maps.app.goo.gl) by following redirect and extracting coords */
async function resolveGoogleMapsUrl(url: string): Promise<{ lat: number; lng: number } | null> {
  try {
    // Check direct query params first before network fetch
    const qMatch = url.match(/[?&](?:q|ll|query)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (qMatch) {
      return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
    }

    // Use GET with redirect: 'follow' (HEAD is blocked by some redirect servers)
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(6000),
    });
    // Immediately cancel response body to avoid downloading page HTML
    if (res.body) {
      await res.body.cancel();
    }
    const finalUrl = res.url;

    // Try to extract coordinates from URL patterns like @-7.123,110.456 or !3d-7.123!4d110.456 or ?q=-7.123,110.456
    const atPattern = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const bangPattern = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/;
    const finalQMatch = finalUrl.match(/[?&](?:q|ll|query)=(-?\d+\.\d+),(-?\d+\.\d+)/);

    if (finalQMatch) {
      return { lat: parseFloat(finalQMatch[1]), lng: parseFloat(finalQMatch[2]) };
    }

    const atMatch = finalUrl.match(atPattern);
    if (atMatch) {
      return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
    }

    const bangMatch = finalUrl.match(bangPattern);
    if (bangMatch) {
      return { lat: parseFloat(bangMatch[1]), lng: parseFloat(bangMatch[2]) };
    }

    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// WhatsApp Bot HTTP response schema
// ---------------------------------------------------------------------------

const WhatsAppSendResponseSchema = z.object({
  success: z.boolean(),
  messageId: z.string().optional(),
  messageIds: z.array(z.string()).optional(),
  bubbleCount: z.number().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});



// ---------------------------------------------------------------------------
// Tool 1: whatsapp_send_message
// ---------------------------------------------------------------------------

async function handleWhatsappSendMessage(args: Record<string, unknown>): Promise<string> {
  const phone = getString(args, 'phone');
  const rawMessage = getString(args, 'message');
  const message = formatRaraMessageWithSignature(rawMessage);

  if (isInternalStaff(phone)) {
    throw new Error(
      `Cannot send automated customer sales message to internal staff/store: ${phone}`
    );
  }

  const config = getWhatsAppConfig();
  const botUrl = config.botUrl;
  const secret = config.botSecret;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (secret) {
    // apps/bot authenticateApiKey middleware expects Bearer token matching SYNC_ERP_BOT_SECRET
    headers.Authorization = `Bearer ${secret}`;
    headers['X-Bot-Secret'] = secret;
  }

  const response = await fetch(`${botUrl}/send-message`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ phone, message }),
    signal: AbortSignal.timeout(30000),
  });

  const rawJson: unknown = await response.json();
  const parsed = WhatsAppSendResponseSchema.safeParse(rawJson);

  if (!parsed.success) {
    throw new Error(`Unexpected response from WhatsApp bot: ${JSON.stringify(rawJson)}`);
  }

  const data = parsed.data;

  if (!response.ok || !data.success) {
    const errMsg = data.message ?? data.error ?? `HTTP ${response.status}`;
    throw new Error(`WhatsApp send failed: ${errMsg}`);
  }

  return JSON.stringify({
    success: true,
    messageId: data.messageId,
    messageIds: data.messageIds,
    bubbleCount: data.bubbleCount ?? 1,
  });
}

// ---------------------------------------------------------------------------
// Tool 2: estimate_delivery_fee
// ---------------------------------------------------------------------------

async function handleEstimateDeliveryFee(args: Record<string, unknown>): Promise<string> {
  const config = getWhatsAppConfig();
  const apiKey = config.googleMapsApiKey.trim();
  if (!apiKey) {
    throw new Error('GOOGLE_MAPS_API_KEY is not configured');
  }

  const address = getOptionalString(args, 'address');
  const latitude = getOptionalNumber(args, 'latitude');
  const longitude = getOptionalNumber(args, 'longitude');

  let destLat: number;
  let destLng: number;
  let resolvedAddress: string;

  if (latitude !== undefined && longitude !== undefined) {
    // Direct coordinates
    destLat = latitude;
    destLng = longitude;
    resolvedAddress = `${latitude}, ${longitude}`;
  } else if (address !== undefined && address.trim().length > 0) {
    const trimmedAddress = address.trim();

    // 1. Direct coordinate pattern inside address text: e.g. "(Koordinat: -7.7588, 110.3986)" or "-7.7588, 110.3986"
    const coordMatch = trimmedAddress.match(/(?:Koordinat:\s*)?(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/i);
    // 2. Embedded URL pattern inside address text
    const urlMatch = trimmedAddress.match(/https?:\/\/[^\s]+/);

    if (coordMatch) {
      destLat = parseFloat(coordMatch[1]);
      destLng = parseFloat(coordMatch[2]);
      resolvedAddress = `Coordinates from text: ${destLat}, ${destLng}`;
    } else if (urlMatch) {
      const coords = await resolveGoogleMapsUrl(urlMatch[0]);
      if (!coords) {
        throw new Error(`Could not extract coordinates from URL: ${urlMatch[0]}`);
      }
      destLat = coords.lat;
      destLng = coords.lng;
      resolvedAddress = `Coordinates from URL: ${destLat}, ${destLng}`;
    } else {
      // Plain address — use Places API
      const place = await searchPlaces(trimmedAddress, apiKey);
      destLat = place.lat;
      destLng = place.lng;
      resolvedAddress = place.address;
    }
  } else {
    throw new Error('Provide either (latitude + longitude) or address');
  }

  const distanceKm = await getDistanceKmFromCoords(destLat, destLng, apiKey);
  const deliveryFee = calculateDeliveryFee(distanceKm);

  return JSON.stringify({ distanceKm: Math.round(distanceKm * 100) / 100, deliveryFee, resolvedAddress });
}

// ---------------------------------------------------------------------------
// Tool 3: set_customer_note
// ---------------------------------------------------------------------------

const CUSTOMER_NOTE_TTL = 2592000; // 30 days

async function handleSetCustomerNote(args: Record<string, unknown>): Promise<string> {
  const phone = getString(args, 'phone');
  const note = getString(args, 'note');

  if (isInternalStaff(phone)) {
    throw new Error(`Cannot set customer note for internal staff or store phone: ${phone}`);
  }

  const normalized = normalizePhone(phone);
  if (isInternalStaff(normalized)) {
    throw new Error(`Cannot set customer note for internal staff or store phone: ${phone}`);
  }
  const key = `whatsapp:customer_note:${normalized}`;
  const redis = getRedisClient();

  await redis.set(key, note, 'EX', CUSTOMER_NOTE_TTL);

  return JSON.stringify({ success: true, phone: normalized, note });
}

// ---------------------------------------------------------------------------
// Tool 4: escalate_to_owner
// ---------------------------------------------------------------------------

const SESSION_MODE_ESCALATION_TTL = 1800; // 30 minutes
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

const TelegramErrorResponseSchema = z.object({
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

async function handleEscalateToOwner(args: Record<string, unknown>): Promise<string> {
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

// ---------------------------------------------------------------------------
// Tool 5: manage_customer_whitelist
// ---------------------------------------------------------------------------

const WHITELIST_KEY = 'whatsapp:allowed_phones';

async function handleManageCustomerWhitelist(args: Record<string, unknown>): Promise<string> {
  const action = getString(args, 'action');
  if (!['add', 'remove', 'list'].includes(action)) {
    throw new Error(`action must be one of: add, remove, list. Got: ${action}`);
  }

  const redis = getRedisClient();

  if (action === 'list') {
    const phones = await redis.smembers(WHITELIST_KEY);
    return JSON.stringify({ phones });
  }

  const phone = getString(args, 'phone');
  const normalized = normalizePhone(phone);

  if (action === 'add') {
    if (isInternalStaff(normalized) || isInternalStaff(phone)) {
      throw new Error(
        `Cannot add internal staff or store phone number to customer whitelist: ${phone}`
      );
    }
    await redis.sadd(WHITELIST_KEY, normalized);
  } else {
    await redis.srem(WHITELIST_KEY, normalized);
  }

  const totalAllowed = await redis.scard(WHITELIST_KEY);
  return JSON.stringify({ success: true, action, phone: normalized, totalAllowed });
}

// ---------------------------------------------------------------------------
// Tool 6: take_over_conversation
// ---------------------------------------------------------------------------

const SESSION_MODE_TAKEOVER_TTL = 7200; // 2 hours

async function handleTakeOverConversation(args: Record<string, unknown>): Promise<string> {
  const phone = getString(args, 'phone');
  const reason = getOptionalString(args, 'reason');
  const normalized = normalizePhone(phone);

  const redis = getRedisClient();
  await redis.set(`whatsapp:session_mode:${normalized}`, 'HUMAN', 'EX', SESSION_MODE_TAKEOVER_TTL);

  // eslint-disable-next-line no-console
  console.log(`[Mute Guard] ${normalized} set to HUMAN (take over, reason: ${reason ?? 'none'})`);

  return JSON.stringify({
    success: true,
    phone: normalized,
    message: 'Bot muted for 2 hours',
    reason,
  });
}

// ---------------------------------------------------------------------------
// Tool 7: return_to_bot
// ---------------------------------------------------------------------------

async function handleReturnToBot(args: Record<string, unknown>): Promise<string> {
  const phone = getString(args, 'phone');
  const normalized = normalizePhone(phone);

  const redis = getRedisClient();
  await redis.del(`whatsapp:session_mode:${normalized}`);
  await redis.del(`whatsapp:session_mute:${normalized}`);

  // eslint-disable-next-line no-console
  console.log(`[Mute Guard] ${normalized} returned to BOT mode`);

  return JSON.stringify({ success: true, phone: normalized, message: 'Bot reactivated' });
}

// ---------------------------------------------------------------------------
// Tool 8: get_last_escalated_lead
// ---------------------------------------------------------------------------

export const GetLastEscalatedLeadArgsSchema = z.object({
  chatId: z.string().optional(),
});

async function handleGetLastEscalatedLead(args: Record<string, unknown>): Promise<string> {
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

// ---------------------------------------------------------------------------
// Tool 9: whatsapp_send_qris
// ---------------------------------------------------------------------------

async function handleWhatsappSendQris(args: Record<string, unknown>): Promise<string> {
  const customerPhone = getString(args, 'customerPhone');
  const phone = normalizePhone(customerPhone);

  const config = getWhatsAppConfig();
  const botUrl = config.botUrl;
  const secret = config.botSecret;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
    headers['X-Bot-Secret'] = secret;
  }

  const response = await fetch(`${botUrl}/send-image`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ phone, imagePath: 'assets/qris.jpg', caption: '' }),
    signal: AbortSignal.timeout(30000),
  });

  const rawJson: unknown = await response.json();
  const parsed = WhatsAppSendResponseSchema.safeParse(rawJson);

  if (!parsed.success) {
    throw new Error(`Unexpected response from WhatsApp bot: ${JSON.stringify(rawJson)}`);
  }

  const data = parsed.data;

  if (!response.ok || !data.success) {
    const errMsg = data.message ?? data.error ?? `HTTP ${response.status}`;
    throw new Error(`WhatsApp send image failed: ${errMsg}`);
  }

  return JSON.stringify({
    success: true,
    messageId: data.messageId,
  });
}

// ---------------------------------------------------------------------------
// Tool 10: rental_order_auto_book_lead
// ---------------------------------------------------------------------------

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

const MONTH_MAP: Record<string, string> = {
  januari: '01', jan: '01', februari: '02', feb: '02', maret: '03', mar: '03',
  april: '04', apr: '04', mei: '05', juni: '06', jun: '06', juli: '07', jul: '07',
  agustus: '08', agu: '08', ags: '08', september: '09', sept: '09', sep: '09',
  oktober: '10', okt: '10', november: '11', nov: '11', desember: '12', des: '12',
};

function extractLeadDetails(leadSummary: string, productInterest: string) {
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

const PartnerListResponseSchema = z.array(z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable().optional(),
}));

const BundleListResponseSchema = z.array(z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string().nullable().optional(),
  dailyRate: z.string().or(z.number()),
}));

const OrderResponseSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  totalAmount: z.string().or(z.number()),
  status: z.string(),
});

const PartnerResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
});

async function handleRentalOrderAutoBookLead(args: Record<string, unknown>): Promise<string> {
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

// ---------------------------------------------------------------------------
// Tool Registry
// ---------------------------------------------------------------------------

export function getWhatsAppTools(): ToolSpec[] {
  return [
    {
      name: 'whatsapp_send_message',
      description:
        'Send a WhatsApp message to a customer phone number. Use this to deliver all replies to the customer. ' +
        'To send multiple chat bubbles in sequence with realistic typing pauses, separate bubbles using "\\n---\\n". ' +
        'Every message must end with the signature tag "-r" on a new line at the very end of the final chat bubble (first/preceding bubbles do NOT carry "-r").',
      inputSchema: {
        type: 'object',
        properties: {
          phone: {
            type: 'string',
            description: 'Customer phone in E.164 format (+628...) or 628... format',
          },
          message: {
            type: 'string',
            description:
              'Message text to send via WhatsApp. Separate 2–3 chat bubbles using "\\n---\\n" (e.g. "halo kak 😊\\n---\\nrencana sewa kapan ya kak?\\n\\n-r"). Final bubble must end with signature tag "-r" on a new line.',
          },
        },
        required: ['phone', 'message'],
      },
      handler: handleWhatsappSendMessage,
    },
    {
      name: 'estimate_delivery_fee',
      description:
        'Calculate delivery fee from Santi Mebel Godean warehouse to a customer location. ' +
        'Accepts address name ("Condongcatur"), a Google Maps URL, or latitude/longitude coordinates.',
      inputSchema: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
            description:
              'Location name (e.g. "Condongcatur") or a Google Maps URL. ' +
              'Use this OR latitude+longitude, not both.',
          },
          latitude: {
            type: 'number',
            description: 'Destination latitude (e.g. -7.7935)',
          },
          longitude: {
            type: 'number',
            description: 'Destination longitude (e.g. 110.3768)',
          },
        },
        required: [],
      },
      handler: handleEstimateDeliveryFee,
    },
    {
      name: 'set_customer_note',
      description:
        'Store a private owner instruction for a specific customer. ' +
        'These notes are injected into Rara\'s webhook prompt each time the customer sends a message. ' +
        'Example: "Simbah Don, berikan diskon 10%". Only accessible via Telegram (not from webhook).',
      inputSchema: {
        type: 'object',
        properties: {
          phone: {
            type: 'string',
            description: 'Customer phone number',
          },
          note: {
            type: 'string',
            description: 'Owner instruction or note for this customer',
          },
        },
        required: ['phone', 'note'],
      },
      handler: handleSetCustomerNote,
    },
    {
      name: 'escalate_to_owner',
      description:
        'Send a structured lead card notification to Don (owner) via Telegram. ' +
        'Also automatically mutes the bot for this customer for 30 minutes. ' +
        'Use for: special discount requests, claims of relationship with owner, customer insisting on delivery/pickup outside operational slots (06.00-09.00 & 17.00-21.00 WIB), complex situations.',
      inputSchema: {
        type: 'object',
        properties: {
          customerPhone: { type: 'string', description: 'Customer phone number' },
          customerName: { type: 'string', description: 'Customer name (or "Unknown")' },
          productInterest: { type: 'string', description: 'What product/service they are interested in' },
          escalationReason: { type: 'string', description: 'Why this needs owner attention' },
          leadSummary: { type: 'string', description: 'Full context summary of the conversation' },
          urgencyLevel: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: 'Lead urgency level',
          },
        },
        required: [
          'customerPhone',
          'customerName',
          'productInterest',
          'escalationReason',
          'leadSummary',
          'urgencyLevel',
        ],
      },
      handler: handleEscalateToOwner,
    },
    {
      name: 'manage_customer_whitelist',
      description:
        'Manage the dynamic customer whitelist stored in Redis. ' +
        'Add or remove phones to allow/block AI responses, or list all currently allowed phones.',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['add', 'remove', 'list'],
            description: 'Action to perform: add a phone, remove a phone, or list all',
          },
          phone: {
            type: 'string',
            description: 'Phone number to add/remove. Not required for "list".',
          },
        },
        required: ['action'],
      },
      handler: handleManageCustomerWhitelist,
    },
    {
      name: 'take_over_conversation',
      description:
        'Mute the bot for a specific customer for 2 hours (HUMAN mode). ' +
        'Use when Don/Admin wants to handle the conversation directly. ' +
        'Only accessible via Telegram — not available from the webhook.',
      inputSchema: {
        type: 'object',
        properties: {
          phone: {
            type: 'string',
            description: 'Customer phone number to mute bot for',
          },
          reason: {
            type: 'string',
            description: 'Optional reason for taking over',
          },
        },
        required: ['phone'],
      },
      handler: handleTakeOverConversation,
    },
    {
      name: 'return_to_bot',
      description:
        'Reactivate the bot for a customer that was previously muted. ' +
        'Deletes the HUMAN session mode from Redis so bot resumes answering. ' +
        'Only accessible via Telegram — not available from the webhook.',
      inputSchema: {
        type: 'object',
        properties: {
          phone: {
            type: 'string',
            description: 'Customer phone number to reactivate bot for',
          },
        },
        required: ['phone'],
      },
      handler: handleReturnToBot,
    },
    {
      name: 'resume_bot',
      description:
        'Reactivate the bot for a customer that was previously muted (HUMAN mode). ' +
        'Deletes the HUMAN session mode from Redis so bot resumes answering. ' +
        'Alias for return_to_bot. Only accessible via Telegram.',
      inputSchema: {
        type: 'object',
        properties: {
          phone: {
            type: 'string',
            description: 'Customer phone number to reactivate bot for',
          },
        },
        required: ['phone'],
      },
      handler: handleReturnToBot,
    },
    {
      name: 'get_last_escalated_lead',
      description:
        'Retrieve the latest customer lead escalated to owner/Don via WhatsApp/Telegram. ' +
        'Use this in Telegram when Don replies with instructions (e.g. "kasih diskon 10%", discount, approval, acc, "take over", tolak, nego) ' +
        'without explicitly stating the customer name or phone number.',
      inputSchema: {
        type: 'object',
        properties: {
          chatId: {
            type: 'string',
            description: 'Telegram chat ID of the owner/recipient (optional, defaults to Don: 8215203590)',
          },
        },
        required: [],
      },
      handler: handleGetLastEscalatedLead,
    },
    {
      name: 'whatsapp_send_qris',
      description: 'Sends the Santi Living QRIS payment QR code image to a customer via WhatsApp. Call this immediately after sending the invoice text — do NOT ask the customer which payment method they prefer first. Only provide BCA transfer details if the customer explicitly asks for bank transfer instead.',
      inputSchema: {
        type: 'object',
        properties: {
          customerPhone: {
            type: 'string',
            description: 'Customer phone number'
          }
        },
        required: ['customerPhone'],
      },
      handler: handleWhatsappSendQris,
    },
    {
      name: 'rental_order_auto_book_lead',
      description:
        'Autonomously create, confirm, and verify a rental order in Sync ERP from the latest escalated lead when Don approves payment (e.g. "sudah masuk" or "acc bayar") on Telegram. ' +
        'Automatically creates/finds the customer partner in Sync ERP, creates the rental order with items and dates, confirms it (CONFIRMED), validates DP payment (CONFIRMED), ' +
        'unmutes the bot, sends the official WhatsApp confirmation message to the customer with the order number, and returns the full order record for Telegram reporting.',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          chatId: {
            type: 'string',
            description: 'Telegram chat ID of owner (optional, defaults to Don: 8215203590)',
          },
          customerPhone: { type: 'string', description: 'Optional override customer phone' },
          customerName: { type: 'string', description: 'Optional override customer name' },
          rentalStartDate: { type: 'string', description: 'Optional override start date (YYYY-MM-DD)' },
          rentalEndDate: { type: 'string', description: 'Optional override end date (YYYY-MM-DD)' },
          bundleSize: { type: 'string', description: 'Optional override bundle size (90, 100, 120, 160, 180)' },
          quantity: { type: 'number', description: 'Optional override quantity' },
          deliveryFee: { type: 'number', description: 'Optional override delivery fee' },
          deliveryAddress: { type: 'string', description: 'Optional override delivery address' },
          notes: { type: 'string', description: 'Optional override notes' },
          paymentReference: { type: 'string', description: 'Optional override payment reference (default: QRIS-DP)' },
        },
        required: ['companyId'],
      },
      handler: handleRentalOrderAutoBookLead,
    },
  ];
}
