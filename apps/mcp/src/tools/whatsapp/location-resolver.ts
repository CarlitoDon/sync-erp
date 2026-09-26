/**
 * Universal Location & Maps Resolver
 *
 * Multi-Tier Universal Location Resolver for WhatsApp customer inquiries.
 * Handles:
 * - WhatsApp Native Location pins & coordinates
 * - Google Maps short-links (maps.app.goo.gl, goo.gl/maps, g.co/maps)
 * - Chain HTTP redirects with realistic User-Agent emulation
 * - Google Maps full URLs, Protobuf coordinates (!3d!4d), @lat,lng, and query params
 * - HTML metadata fallback scraper (og:title, meta description, page title)
 * - Google Plus Codes (e.g. 6P58+XQ Sinduadi)
 * - Apple Maps and Waze share links
 * - Plain text addresses and landmark search with DIY Yogyakarta geofencing
 * - Google Routes API distance & round-trip fee calculation
 */

import { z } from 'zod';
import { getWhatsAppConfig } from '../../config.js';
import {
  WAREHOUSE_LAT,
  WAREHOUSE_LNG,
  calculateDeliveryFee,
  getDistanceKmFromCoords,
  searchPlaces,
} from './delivery-fee.js';

export interface LocationResolutionResult {
  success: boolean;
  resolvedAddress: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  deliveryFee: number;
  sourceType:
    | 'direct_coordinates'
    | 'url_coordinates'
    | 'url_protobuf_coords'
    | 'url_query_text'
    | 'url_place_path'
    | 'html_metadata'
    | 'plus_code'
    | 'text_address';
  operationalNotes: string;
}

const USER_AGENT = 'curl/8.7.1';

/**
 * Follows HTTP redirects manually up to maxHops to intercept location headers
 * without downloading bulky web payloads.
 */
export async function followRedirectChain(
  startUrl: string,
  maxHops = 7,
): Promise<string> {
  let currentUrl = startUrl;

  for (let hop = 0; hop < maxHops; hop++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent': USER_AGENT,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (location) {
          currentUrl = new URL(location, currentUrl).toString();
          continue;
        }
      }
      break;
    } catch {
      break;
    }
  }

  return currentUrl;
}

/**
 * Parses coordinates directly from URL query parameters or path patterns.
 */
export function extractCoordsFromUrl(
  urlStr: string,
): { lat: number; lng: number; type: LocationResolutionResult['sourceType'] } | null {
  const atPattern = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
  const bangPattern = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/;
  const qCoordPattern =
    /[?&](?:q|ll|query|destination|daddr)=(-?\d+\.\d+),(-?\d+\.\d+)/;
  const appleWazeCoordPattern = /[?&](?:ll|loc)=(-?\d+\.\d+),(-?\d+\.\d+)/;

  const qCoord = urlStr.match(qCoordPattern);
  if (qCoord) {
    return {
      lat: parseFloat(qCoord[1]),
      lng: parseFloat(qCoord[2]),
      type: 'url_coordinates',
    };
  }

  const bang = urlStr.match(bangPattern);
  if (bang) {
    return {
      lat: parseFloat(bang[1]),
      lng: parseFloat(bang[2]),
      type: 'url_protobuf_coords',
    };
  }

  const at = urlStr.match(atPattern);
  if (at) {
    return {
      lat: parseFloat(at[1]),
      lng: parseFloat(at[2]),
      type: 'url_coordinates',
    };
  }

  const alt = urlStr.match(appleWazeCoordPattern);
  if (alt) {
    return {
      lat: parseFloat(alt[1]),
      lng: parseFloat(alt[2]),
      type: 'url_coordinates',
    };
  }

  return null;
}

/**
 * Extracts place name or text address query from URL query strings or paths.
 */
export function extractPlaceTextFromUrl(
  urlStr: string,
): { query: string; type: LocationResolutionResult['sourceType'] } | null {
  try {
    const u = new URL(urlStr);

    // 1. Check searchParams: q, query, destination, daddr
    const q =
      u.searchParams.get('q') ||
      u.searchParams.get('query') ||
      u.searchParams.get('destination') ||
      u.searchParams.get('daddr') ||
      u.searchParams.get('address');

    if (q && q.trim().length > 0) {
      // If q is numeric coordinates, let coord extractor handle it
      if (!/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(q.trim())) {
        return {
          query: q.trim(),
          type: 'url_query_text',
        };
      }
    }

    // 2. Check path pattern: /maps/place/<Place+Name>/...
    const placeMatch = u.pathname.match(/\/place\/([^/@?]+)/);
    if (placeMatch && placeMatch[1]) {
      const decoded = decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')).trim();
      if (decoded.length > 0) {
        return {
          query: decoded,
          type: 'url_place_path',
        };
      }
    }

    // 3. Check /maps/search/<Query>/...
    const searchMatch = u.pathname.match(/\/search\/([^/@?]+)/);
    if (searchMatch && searchMatch[1]) {
      const decoded = decodeURIComponent(searchMatch[1].replace(/\+/g, ' ')).trim();
      if (decoded.length > 0) {
        return {
          query: decoded,
          type: 'url_place_path',
        };
      }
    }
  } catch {
    // ignore URL parsing error
  }

  return null;
}

/**
 * Fallback HTML metadata scraper for URLs where place name is in og:title or title tag.
 */
export async function scrapeHtmlPlaceMeta(
  targetUrl: string,
): Promise<{ query: string; type: LocationResolutionResult['sourceType'] } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) return null;

    const html = await res.text();

    // Check og:title
    const ogTitleMatch =
      html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
      html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i);

    if (ogTitleMatch && ogTitleMatch[1]) {
      const title = ogTitleMatch[1].trim();
      if (title.length > 2 && !/^google maps$/i.test(title)) {
        return { query: title, type: 'html_metadata' };
      }
    }

    // Check <title>
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      const rawTitle = titleMatch[1].trim();
      const cleaned = rawTitle.replace(/\s*-\s*Google Maps.*$/i, '').trim();
      if (cleaned.length > 2 && !/^google maps$/i.test(cleaned)) {
        return { query: cleaned, type: 'html_metadata' };
      }
    }

    // Check meta description
    const descMatch =
      html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
      html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);

    if (descMatch && descMatch[1]) {
      const desc = descMatch[1].trim();
      if (desc.length > 5 && !desc.toLowerCase().startsWith('temukan bisnis')) {
        return { query: desc, type: 'html_metadata' };
      }
    }
  } catch {
    // Non-fatal fallback
  }

  return null;
}

/**
 * Universal location resolver function.
 * Resolves coordinates, address, distance, and ongkir from any raw text or URL.
 */
export async function resolveUniversalLocation(
  rawInput: string,
): Promise<LocationResolutionResult> {
  const config = getWhatsAppConfig();
  const apiKey = config.googleMapsApiKey.trim();
  if (!apiKey) {
    throw new Error('GOOGLE_MAPS_API_KEY is not configured');
  }

  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error('Alamat atau link lokasi tidak boleh kosong');
  }

  let destLat: number | null = null;
  let destLng: number | null = null;
  let resolvedAddress = '';
  let sourceType: LocationResolutionResult['sourceType'] = 'text_address';

  // 1. Direct coordinate pattern in input text (e.g. "-7.7588, 110.3986" or "Koordinat: -7.7588, 110.3986")
  const coordMatch = trimmed.match(
    /(?:Koordinat:\s*)?(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/i,
  );

  // 2. URL embedded in input text
  const urlMatch = trimmed.match(/https?:\/\/[^\s]+/);

  if (urlMatch) {
    const rawUrl = urlMatch[0];
    const finalUrl = await followRedirectChain(rawUrl);

    // Try extracting coords directly from final URL
    const coords = extractCoordsFromUrl(finalUrl);
    if (coords) {
      destLat = coords.lat;
      destLng = coords.lng;
      sourceType = coords.type;
      resolvedAddress = `Koordinat Titik: ${destLat}, ${destLng}`;
    } else {
      // Try extracting place name or query text from URL
      const placeText = extractPlaceTextFromUrl(finalUrl);
      let queryToSearch = placeText?.query;
      sourceType = placeText?.type ?? 'url_query_text';

      // If URL had no place text in params/path, scrape HTML meta
      if (!queryToSearch) {
        const scraped = await scrapeHtmlPlaceMeta(finalUrl);
        if (scraped) {
          queryToSearch = scraped.query;
          sourceType = 'html_metadata';
        }
      }

      if (!queryToSearch) {
        throw new Error(
          `Tidak dapat menemukan informasi tempat atau koordinat dari tautan: ${rawUrl}`,
        );
      }

      const place = await searchPlaces(queryToSearch, apiKey);
      destLat = place.lat;
      destLng = place.lng;
      resolvedAddress = place.address;
    }
  } else if (coordMatch) {
    destLat = parseFloat(coordMatch[1]);
    destLng = parseFloat(coordMatch[2]);
    sourceType = 'direct_coordinates';
    resolvedAddress = `Koordinat Manual: ${destLat}, ${destLng}`;
  } else {
    // 3. Plus Code pattern (e.g. "6P58+XQ Sinduadi" or "6P58+XQ")
    const plusCodePattern =
      /\b([23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3})\b/i;
    const isPlusCode = plusCodePattern.test(trimmed);

    let searchQuery = trimmed;
    if (isPlusCode) {
      sourceType = 'plus_code';
      if (!trimmed.toLowerCase().includes('yogyakarta') && !trimmed.toLowerCase().includes('sleman')) {
        searchQuery = `${trimmed}, Yogyakarta`;
      }
    }

    const place = await searchPlaces(searchQuery, apiKey);
    destLat = place.lat;
    destLng = place.lng;
    resolvedAddress = place.address;
  }

  if (destLat == null || destLng == null) {
    throw new Error(`Gagal menentukan titik koordinat untuk: "${trimmed}"`);
  }

  // Calculate driving distance via Google Routes API
  const distanceKm = await getDistanceKmFromCoords(destLat, destLng, apiKey);
  const deliveryFee = calculateDeliveryFee(distanceKm);

  const roundedDistance = Math.round(distanceKm * 100) / 100;

  return {
    success: true,
    resolvedAddress,
    latitude: destLat,
    longitude: destLng,
    distanceKm: roundedDistance,
    deliveryFee,
    sourceType,
    operationalNotes:
      'Area tercover armada internal Santi Mebel Godean (Slot Pagi 06.00–09.00 & Sore 17.00–21.00 WIB)',
  };
}

/**
 * Handler for the MCP tool resolve_customer_location
 */
export async function handleResolveCustomerLocation(
  args: Record<string, unknown>,
): Promise<string> {
  const rawInput =
    typeof args.location === 'string'
      ? args.location
      : typeof args.address === 'string'
        ? args.address
        : typeof args.url === 'string'
          ? args.url
          : '';

  if (!rawInput.trim()) {
    throw new Error(
      'Parameter "location" (berisi link Google Maps, Plus Code, koordinat, atau teks alamat) wajib diisi',
    );
  }

  const result = await resolveUniversalLocation(rawInput);
  return JSON.stringify(result, null, 2);
}
