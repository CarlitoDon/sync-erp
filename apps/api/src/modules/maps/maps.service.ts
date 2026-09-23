import { z } from 'zod';

export interface FormattedLocationAddress {
  street: string;
  kelurahan: string;
  kecamatan: string;
  kota: string;
  provinsi: string;
  zip: string;
  fullAddress: string;
  latitude: number;
  longitude: number;
}

export interface PlaceSearchResult {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

const NominatimAddressSchema = z.object({
  road: z.string().optional(),
  neighbourhood: z.string().optional(),
  suburb: z.string().optional(),
  village: z.string().optional(),
  hamlet: z.string().optional(),
  city_district: z.string().optional(),
  municipality: z.string().optional(),
  city: z.string().optional(),
  town: z.string().optional(),
  county: z.string().optional(),
  state: z.string().optional(),
  province: z.string().optional(),
  region: z.string().optional(),
  postcode: z.string().optional(),
  'ISO3166-2-lvl4': z.string().optional(),
  'ISO3166-2-lvl3': z.string().optional(),
});

const NominatimResponseSchema = z.object({
  lat: z.string(),
  lon: z.string(),
  display_name: z.string().optional(),
  address: NominatimAddressSchema.optional(),
});

const NominatimSearchResultSchema = z.array(
  z.object({
    place_id: z.number().or(z.string()),
    lat: z.string(),
    lon: z.string(),
    display_name: z.string(),
    name: z.string().optional(),
  })
);

const GOOGLE_PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
const GOOGLE_PLACES_TIMEOUT_MS = 5_000;
const HTTP_REQUEST_TIMEOUT_MS = 5_000;

const GooglePlacesResponseSchema = z.object({
  places: z.array(
    z.object({
      id: z.string(),
      displayName: z.object({ text: z.string() }),
      formattedAddress: z.string(),
      location: z.object({ latitude: z.number(), longitude: z.number() }),
    })
  ).optional().default([]),
});

export class MapsService {
  /**
   * Extract coordinates from any Google Maps link or coordinate string
   */
  extractCoordinatesFromText(text: string): { lat: number; lng: number } | null {
    if (!text || typeof text !== 'string') return null;
    const trimmed = text.trim();
    let decoded = trimmed;
    try {
      decoded = decodeURIComponent(trimmed);
    } catch {
      // Ignore URI malformed errors
    }

    // 1. Direct coordinate string: "-7.7956, 110.3695" or "-7.7956,110.3695" or "-7.7956 110.3695" or "-7, 110"
    const directMatch = decoded.match(/^(-?\d+(?:\.\d+)?)(?:\s*,\s*|\s+)(-?\d+(?:\.\d+)?)$/);
    if (directMatch) {
      const lat = parseFloat(directMatch[1]);
      const lng = parseFloat(directMatch[2]);
      if (this.isValidCoords(lat, lng)) {
        return { lat, lng };
      }
    }

    // 1b. DMS format: e.g. 7°46'37.0"S 110°22'06.7"E or 7°46.5'S 110°22.8'E or 7°46'S 110°22'E
    const dmsMatch = this.parseDmsCoordinates(decoded);
    if (dmsMatch) {
      return dmsMatch;
    }

    // 2. URL containing /@lat,lng
    const atMatch = decoded.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (atMatch) {
      const lat = parseFloat(atMatch[1]);
      const lng = parseFloat(atMatch[2]);
      if (this.isValidCoords(lat, lng)) {
        return { lat, lng };
      }
    }

    // 3. Query params: q=lat,lng or ll=lat,lng or query=lat,lng or daddr=lat,lng etc. (handles + or , or %2C)
    const queryMatch =
      decoded.match(/[?&](?:q|ll|query|daddr|destination|center|saddr|origin)=(-?\d+(?:\.\d+)?)(?:,\+?|\+|,|\s+)(-?\d+(?:\.\d+)?)/i) ||
      trimmed.match(/[?&](?:q|ll|query|daddr|destination|center|saddr|origin)=(-?\d+(?:\.\d+)?)(?:%2C|,\+?|\+|,|\s+)(-?\d+(?:\.\d+)?)/i);
    if (queryMatch) {
      const lat = parseFloat(queryMatch[1]);
      const lng = parseFloat(queryMatch[2]);
      if (this.isValidCoords(lat, lng)) {
        return { lat, lng };
      }
    }

    // 4. URL path: /(?:search|place|dir)/lat,lng
    const pathMatch = decoded.match(/\/(?:search|place|dir)\/(-?\d+(?:\.\d+)?)(?:,\+?|\+|,|\s+)(-?\d+(?:\.\d+)?)/i);
    if (pathMatch) {
      const lat = parseFloat(pathMatch[1]);
      const lng = parseFloat(pathMatch[2]);
      if (this.isValidCoords(lat, lng)) {
        return { lat, lng };
      }
    }

    // 5. Pattern: !3dlat!4dlng (Google Maps protobuf embedding in URL)
    const protoMatch = decoded.match(/!3d(-?\d+(?:\.\d+)?)[!&]4d(-?\d+(?:\.\d+)?)/);
    if (protoMatch) {
      const lat = parseFloat(protoMatch[1]);
      const lng = parseFloat(protoMatch[2]);
      if (this.isValidCoords(lat, lng)) {
        return { lat, lng };
      }
    }

    // 6. geo:lat,lng
    const geoMatch = decoded.match(/geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i);
    if (geoMatch) {
      const lat = parseFloat(geoMatch[1]);
      const lng = parseFloat(geoMatch[2]);
      if (this.isValidCoords(lat, lng)) {
        return { lat, lng };
      }
    }

    // 7. Center or coordinates embedded in staticmap URL: center=lat,lng
    const staticCenterMatch =
      decoded.match(/(?:center|ll)=(-?\d+(?:\.\d+)?)(?:,\+?|\+|,|\s+)(-?\d+(?:\.\d+)?)/i) ||
      trimmed.match(/(?:center|ll)=(-?\d+(?:\.\d+)?)(?:%2C|,\+?|\+|,|\s+)(-?\d+(?:\.\d+)?)/i);
    if (staticCenterMatch) {
      const lat = parseFloat(staticCenterMatch[1]);
      const lng = parseFloat(staticCenterMatch[2]);
      if (this.isValidCoords(lat, lng)) {
        return { lat, lng };
      }
    }

    return null;
  }

  /**
   * Resolve shortened URL (e.g. maps.app.goo.gl or goo.gl) and extract coordinates
   */
  async resolveUrlAndExtractCoords(rawUrl: string): Promise<{ lat: number; lng: number } | null> {
    const directCoords = this.extractCoordinatesFromText(rawUrl);
    if (directCoords) return directCoords;

    const trimmed = rawUrl.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return null;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HTTP_REQUEST_TIMEOUT_MS);
      // Follow redirects to find target destination URL
      const response = await fetch(trimmed, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const finalUrl = response.url;
      const coordsFromFinalUrl = this.extractCoordinatesFromText(finalUrl);
      if (coordsFromFinalUrl) return coordsFromFinalUrl;

      // If coordinates are in HTML meta tags or body
      const htmlText = await response.text();

      // Check for meta tags (og:image or staticmap or maps URL)
      const staticMapMatch = htmlText.match(/staticmap\?[^"'\s]*/i);
      if (staticMapMatch) {
        const coordsFromStatic = this.extractCoordinatesFromText(staticMapMatch[0]);
        if (coordsFromStatic) return coordsFromStatic;
      }

      const metaMatch = htmlText.match(/https:\/\/(?:www\.)?(?:google\.com\/maps|maps\.google\.com)\?[^"'\s]*/i);
      if (metaMatch) {
        const coordsFromMeta = this.extractCoordinatesFromText(metaMatch[0]);
        if (coordsFromMeta) return coordsFromMeta;
      }

      // Check for window.APP_INITIALIZATION_STATE or coords in page script
      const pageCoordsMatch = htmlText.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/);
      if (pageCoordsMatch) {
        const lat = parseFloat(pageCoordsMatch[1]);
        const lng = parseFloat(pageCoordsMatch[2]);
        if (this.isValidCoords(lat, lng)) {
          return { lat, lng };
        }
      }
    } catch (err) {
      console.warn('[MapsService] Error expanding URL:', err instanceof Error ? err.message : String(err));
    }

    return null;
  }

  /**
   * Reverse geocode coordinates via OpenStreetMap Nominatim
   */
  async reverseGeocode(lat: number, lng: number): Promise<FormattedLocationAddress> {
    if (!this.isValidCoords(lat, lng)) {
      throw new Error(`Koordinat tidak valid: ${lat}, ${lng}`);
    }

    const roundedLat = Math.round(lat * 1000000) / 1000000;
    const roundedLng = Math.round(lng * 1000000) / 1000000;

    const nominatimUrl = new URL('https://nominatim.openstreetmap.org/reverse');
    nominatimUrl.searchParams.set('format', 'json');
    nominatimUrl.searchParams.set('lat', String(roundedLat));
    nominatimUrl.searchParams.set('lon', String(roundedLng));
    nominatimUrl.searchParams.set('zoom', '18');
    nominatimUrl.searchParams.set('addressdetails', '1');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HTTP_REQUEST_TIMEOUT_MS);
    const response = await fetch(nominatimUrl.toString(), {
      headers: {
        'Accept-Language': 'id',
        'User-Agent': 'SyncERP/1.0 (internal-erp-system)',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      throw new Error(`Gagal reverse geocode dari OpenStreetMap (Status ${response.status})`);
    }

    const rawData: unknown = await response.json();
    const parsed = NominatimResponseSchema.safeParse(rawData);
    if (!parsed.success) {
      throw new Error('Format respon reverse geocode tidak valid');
    }

    const addr = parsed.data.address || {};
    const displayName = parsed.data.display_name || '';

    return this.formatNominatimAddress(addr, displayName, roundedLat, roundedLng);
  }

  /**
   * Search places via Google Places API (New) or fallback to OpenStreetMap Nominatim
   */
  async searchPlaces(query: string): Promise<PlaceSearchResult[]> {
    if (!query || query.trim().length < 3) return [];

    const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
    if (apiKey) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), GOOGLE_PLACES_TIMEOUT_MS);
        const response = await fetch(GOOGLE_PLACES_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask':
              'places.id,places.displayName,places.formattedAddress,places.location',
          },
          body: JSON.stringify({
            textQuery: query.trim(),
            pageSize: 5,
            languageCode: 'id',
            regionCode: 'ID',
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) {
          const rawData: unknown = await response.json();
          const parsed = GooglePlacesResponseSchema.safeParse(rawData);
          if (parsed.success && parsed.data.places && parsed.data.places.length > 0) {
            return parsed.data.places.map((place) => ({
              id: place.id,
              name: place.displayName.text,
              address: place.formattedAddress,
              latitude: place.location.latitude,
              longitude: place.location.longitude,
            }));
          }
        }
      } catch (err) {
        console.warn(
          '[MapsService] Google Places search failed, falling back to Nominatim:',
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    return this.searchPlacesNominatim(query);
  }

  async searchPlacesNominatim(query: string): Promise<PlaceSearchResult[]> {
    const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search');
    nominatimUrl.searchParams.set('format', 'json');
    nominatimUrl.searchParams.set('q', query.trim());
    nominatimUrl.searchParams.set('countrycodes', 'id');
    nominatimUrl.searchParams.set('limit', '5');
    nominatimUrl.searchParams.set('addressdetails', '1');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HTTP_REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(nominatimUrl.toString(), {
        headers: {
          'Accept-Language': 'id',
          'User-Agent': 'SyncERP/1.0 (internal-erp-system)',
        },
        signal: controller.signal,
      });

      if (!response.ok) return [];

      const rawData: unknown = await response.json();
      const parsed = NominatimSearchResultSchema.safeParse(rawData);
      if (!parsed.success) return [];

      return parsed.data.map((item) => ({
        id: String(item.place_id),
        name: item.name || item.display_name.split(',')[0] || query,
        address: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
      }));
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Combined method: given a URL or text, extract coordinates and reverse geocode
   */
  async extractAddressFromUrl(urlOrText: string): Promise<FormattedLocationAddress> {
    const coords = await this.resolveUrlAndExtractCoords(urlOrText);
    if (!coords) {
      throw new Error('Tidak dapat mengekstrak titik koordinat dari tautan atau teks yang diberikan.');
    }
    return this.reverseGeocode(coords.lat, coords.lng);
  }

  parseDmsCoordinates(text: string): { lat: number; lng: number } | null {
    if (!text || typeof text !== 'string') return null;

    // Handles standard DMS (7°46'37.0"S 110°22'06.7"E), DM (7°46.5'S 110°22.8'E),
    // degrees-minutes (7°46'S 110°22'E), and prefix cardinal directions (S 7° 46' 37" E 110° 22' 06")
    const dmsRegex =
      /([NS])?\s*(\d+(?:\.\d+)?)[°d\s]+(\d+(?:\.\d+)?)[′'m\s]*(?:(\d+(?:\.\d+)?)(?:["″]|''|\s*))?\s*([NS])?[\s,]+([EW])?\s*(\d+(?:\.\d+)?)[°d\s]+(\d+(?:\.\d+)?)[′'m\s]*(?:(\d+(?:\.\d+)?)(?:["″]|''|\s*))?\s*([EW])?/i;
    const match = text.match(dmsRegex);
    if (!match) return null;

    const latPrefixDir = match[1];
    const latDeg = parseFloat(match[2]);
    const latMin = parseFloat(match[3]);
    const latSec = match[4] ? parseFloat(match[4]) : 0;
    const latSuffixDir = match[5];
    const latDir = (latPrefixDir || latSuffixDir || '').toUpperCase();

    const lngPrefixDir = match[6];
    const lngDeg = parseFloat(match[7]);
    const lngMin = parseFloat(match[8]);
    const lngSec = match[9] ? parseFloat(match[9]) : 0;
    const lngSuffixDir = match[10];
    const lngDir = (lngPrefixDir || lngSuffixDir || '').toUpperCase();

    if (!latDir || !lngDir) return null;

    let lat = latDeg + latMin / 60 + latSec / 3600;
    if (latDir === 'S') lat = -lat;

    let lng = lngDeg + lngMin / 60 + lngSec / 3600;
    if (lngDir === 'W') lng = -lng;

    const roundedLat = Math.round(lat * 1000000) / 1000000;
    const roundedLng = Math.round(lng * 1000000) / 1000000;

    if (this.isValidCoords(roundedLat, roundedLng)) {
      return { lat: roundedLat, lng: roundedLng };
    }
    return null;
  }

  private isValidCoords(lat: number, lng: number): boolean {
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  private formatNominatimAddress(
    addr: z.infer<typeof NominatimAddressSchema>,
    displayName: string,
    lat: number,
    lng: number
  ): FormattedLocationAddress {
    const road = addr.road || '';

    // Kelurahan / Desa:
    // Check suburb (urban), village, hamlet
    const kelurahan = addr.suburb || addr.village || addr.hamlet || '';

    // Kecamatan:
    // city_district or municipality
    const kecamatan = addr.city_district || addr.municipality || '';

    // Kabupaten/Kota:
    const cityCandidate = addr.city || addr.town || '';
    const countyCandidate = addr.county || '';
    const explicitlyTypedCity = [cityCandidate, countyCandidate].find((v) => /^(kabupaten|kota)\s+/i.test(v));
    const kota = explicitlyTypedCity || countyCandidate || cityCandidate;

    // Provinsi:
    let provinsi = addr.state || addr.province || addr.region || '';
    if (!provinsi) {
      const iso = addr['ISO3166-2-lvl4'] || addr['ISO3166-2-lvl3'] || '';
      if (iso === 'ID-YO') provinsi = 'Daerah Istimewa Yogyakarta';
      else if (iso === 'ID-JK') provinsi = 'DKI Jakarta';
      else if (iso === 'ID-JT') provinsi = 'Jawa Tengah';
      else if (iso === 'ID-JB') provinsi = 'Jawa Barat';
      else if (iso === 'ID-JI') provinsi = 'Jawa Timur';
      else provinsi = iso;
    }

    const zip = addr.postcode || '';

    // Street / Alamat Jalan
    const street = road || addr.neighbourhood || kelurahan || displayName.split(',')[0]?.trim() || '';

    // Full Address
    const parts: string[] = [];
    if (street) parts.push(street);
    if (kelurahan && kelurahan !== street) parts.push(kelurahan);
    if (kecamatan) parts.push(kecamatan);
    if (kota) parts.push(kota);
    if (provinsi) parts.push(provinsi);
    if (zip) parts.push(zip);

    const fullAddress = parts.join(', ') || displayName;

    return {
      street,
      kelurahan,
      kecamatan,
      kota,
      provinsi,
      zip,
      fullAddress,
      latitude: lat,
      longitude: lng,
    };
  }
}
