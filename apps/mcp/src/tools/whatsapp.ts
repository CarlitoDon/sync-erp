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
import { getString, getOptionalString, getOptionalNumber } from './_helpers.js';
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

import { normalizePhone, BUBBLE_DELIMITER_REGEX, splitBubbles, formatRaraMessageWithSignature } from '@sync-erp/shared/whatsapp';

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
export const LAST_ESCALATION_TTL = 3600; // 1 hour

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

export function buildLeadCard(params: z.infer<typeof EscalateArgsSchema>): string {
  const urgencyEmoji: Record<string, string> = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    critical: '🔴',
  };
  const emoji = urgencyEmoji[params.urgencyLevel] ?? '⚪';
  return [
    '🚨 ESKALASI LEAD MASUK',
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
    '• "Kasih diskon 10%" / "acc jam 12" → saya set note + WA customer',
    '• "Take over" → saya mute, kamu handle langsung',
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
  ];
}
