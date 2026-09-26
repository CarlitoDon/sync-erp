import { z } from 'zod';
import { getOptionalString, getOptionalNumber } from '../_helpers.js';
import { getWhatsAppConfig } from '../../config.js';

export const WAREHOUSE_LAT = -7.7673015;
export const WAREHOUSE_LNG = 110.2938902;
export const GOOGLE_ROUTES_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';
export const GOOGLE_PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
export const ROUTES_TIMEOUT_MS = 12000;
export const PLACES_TIMEOUT_MS = 10000;
export const PLACES_MAX_BIAS_RADIUS_METERS = 50_000;

export const RoutesResponseSchema = z.object({
  routes: z.array(z.object({
    distanceMeters: z.number().positive(),
  })).min(1),
});

export const GooglePlacesResponseSchema = z.object({
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

export async function getDistanceKmFromCoords(
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

    const rawJson: unknown = await response.json();
    const parsed = RoutesResponseSchema.safeParse(rawJson);
    if (!parsed.success) {
      throw new Error('Google Routes API response is invalid');
    }

    return parsed.data.routes[0].distanceMeters / 1000;
  } finally {
    clearTimeout(timeout);
  }
}

export function isDiyAddressComponent(
  components: Array<{ longText: string; shortText?: string; types: string[] }> | undefined,
): boolean {
  const province = components?.find((c) => c.types.includes('administrative_area_level_1'));
  const value = `${province?.longText ?? ''} ${province?.shortText ?? ''}`.toLowerCase();
  return value.includes('yogyakarta') || /(^|\s)diy($|\s)/.test(value);
}

export async function searchPlaces(
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

    const rawJson: unknown = await response.json();
    const parsed = GooglePlacesResponseSchema.safeParse(rawJson);
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
export async function resolveGoogleMapsUrl(url: string): Promise<{ lat: number; lng: number } | null> {
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

import { resolveUniversalLocation } from './location-resolver.js';

export async function handleEstimateDeliveryFee(args: Record<string, unknown>): Promise<string> {
  const address = getOptionalString(args, 'address');
  const latitude = getOptionalNumber(args, 'latitude');
  const longitude = getOptionalNumber(args, 'longitude');

  if (latitude !== undefined && longitude !== undefined) {
    const config = getWhatsAppConfig();
    const apiKey = config.googleMapsApiKey.trim();
    if (!apiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY is not configured');
    }
    const distanceKm = await getDistanceKmFromCoords(latitude, longitude, apiKey);
    const deliveryFee = calculateDeliveryFee(distanceKm);
    return JSON.stringify({
      distanceKm: Math.round(distanceKm * 100) / 100,
      deliveryFee,
      resolvedAddress: `${latitude}, ${longitude}`,
    });
  }

  if (address !== undefined && address.trim().length > 0) {
    const res = await resolveUniversalLocation(address);
    return JSON.stringify({
      distanceKm: res.distanceKm,
      deliveryFee: res.deliveryFee,
      resolvedAddress: res.resolvedAddress,
    });
  }

  throw new Error('Provide either (latitude + longitude) or address');
}
