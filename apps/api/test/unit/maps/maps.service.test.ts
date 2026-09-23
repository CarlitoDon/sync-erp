import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MapsService } from '../../../src/modules/maps/maps.service';

describe('MapsService', () => {
  let service: MapsService;

  beforeEach(() => {
    service = new MapsService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('extractCoordinatesFromText', () => {
    it('extracts coordinates from direct comma-separated string', () => {
      const res = service.extractCoordinatesFromText('-7.7956, 110.3695');
      expect(res).toEqual({ lat: -7.7956, lng: 110.3695 });
    });

    it('extracts coordinates without space', () => {
      const res = service.extractCoordinatesFromText('-7.7956,110.3695');
      expect(res).toEqual({ lat: -7.7956, lng: 110.3695 });
    });

    it('extracts coordinates from Google Maps /@lat,lng format', () => {
      const url =
        'https://www.google.com/maps/place/Hotel+Tentrem/@-7.771234,110.368765,17z/data=!3m1';
      const res = service.extractCoordinatesFromText(url);
      expect(res).toEqual({ lat: -7.771234, lng: 110.368765 });
    });

    it('extracts coordinates from ?q=lat,lng query param', () => {
      const url = 'https://maps.google.com/?q=-7.789123,110.398765';
      const res = service.extractCoordinatesFromText(url);
      expect(res).toEqual({ lat: -7.789123, lng: 110.398765 });
    });

    it('extracts coordinates from protobuf !3d !4d markers', () => {
      const url =
        'https://www.google.com/maps/place/Data/!3d-7.801234!4d110.371234';
      const res = service.extractCoordinatesFromText(url);
      expect(res).toEqual({ lat: -7.801234, lng: 110.371234 });
    });

    it('extracts coordinates from space-separated coordinates string', () => {
      const res = service.extractCoordinatesFromText('-7.7956 110.3695');
      expect(res).toEqual({ lat: -7.7956, lng: 110.3695 });
    });

    it('extracts coordinates from Google Maps query with + sign', () => {
      const url = 'https://maps.google.com/?q=-7.789123,+110.398765';
      const res = service.extractCoordinatesFromText(url);
      expect(res).toEqual({ lat: -7.789123, lng: 110.398765 });
    });

    it('extracts coordinates from URL encoded query %2C', () => {
      const url =
        'https://www.google.com/maps/search/?api=1&query=-7.789123%2C110.398765';
      const res = service.extractCoordinatesFromText(url);
      expect(res).toEqual({ lat: -7.789123, lng: 110.398765 });
    });

    it('extracts coordinates from Google Maps place or search path', () => {
      const url = 'https://www.google.com/maps/place/-7.789123,110.398765';
      const res = service.extractCoordinatesFromText(url);
      expect(res).toEqual({ lat: -7.789123, lng: 110.398765 });
    });

    it('extracts coordinates from daddr or destination query params', () => {
      const url = 'https://maps.google.com/?daddr=-7.789123,110.398765';
      const res = service.extractCoordinatesFromText(url);
      expect(res).toEqual({ lat: -7.789123, lng: 110.398765 });
    });

    it('extracts coordinates from geo: URI', () => {
      const url = 'geo:-7.789123,110.398765';
      const res = service.extractCoordinatesFromText(url);
      expect(res).toEqual({ lat: -7.789123, lng: 110.398765 });
    });

    it('extracts coordinates from DMS (Degrees Minutes Seconds) strings', () => {
      const res = service.extractCoordinatesFromText('7°46\'37.0"S 110°22\'06.7"E');
      expect(res).not.toBeNull();
      expect(res?.lat).toBeCloseTo(-7.776944, 4);
      expect(res?.lng).toBeCloseTo(110.368528, 4);
    });

    it('extracts coordinates from DM (Degrees and Minutes) format without seconds', () => {
      const res = service.extractCoordinatesFromText('7°46\'S 110°22\'E');
      expect(res).not.toBeNull();
      expect(res?.lat).toBeCloseTo(-7.766667, 4);
      expect(res?.lng).toBeCloseTo(110.366667, 4);
    });

    it('extracts coordinates from cardinal prefix format', () => {
      const res = service.extractCoordinatesFromText('S 7° 46\' 37" E 110° 22\' 06"');
      expect(res).not.toBeNull();
      expect(res?.lat).toBeCloseTo(-7.776944, 4);
      expect(res?.lng).toBeCloseTo(110.368333, 4);
    });

    it('extracts coordinates from integer coordinate strings', () => {
      const res = service.extractCoordinatesFromText('-7, 110');
      expect(res).toEqual({ lat: -7, lng: 110 });
    });

    it('extracts coordinates from URL with integer query params', () => {
      const res = service.extractCoordinatesFromText('https://maps.google.com/?q=-7,110');
      expect(res).toEqual({ lat: -7, lng: 110 });
    });

    it('returns null for invalid or out-of-range coordinates', () => {
      expect(service.extractCoordinatesFromText('')).toBeNull();
      expect(service.extractCoordinatesFromText('not a url')).toBeNull();
      expect(service.extractCoordinatesFromText('999.0, 110.0')).toBeNull();
    });
  });

  describe('reverseGeocode', () => {
    it('correctly maps Nominatim response into Indonesian administrative structure', async () => {
      const mockResponse = {
        lat: '-7.7956',
        lon: '110.3695',
        display_name:
          'Jl. Malioboro, Sosromenduran, Gedong Tengen, Kota Yogyakarta, Daerah Istimewa Yogyakarta, 55271, Indonesia',
        address: {
          road: 'Jl. Malioboro',
          suburb: 'Sosromenduran',
          city_district: 'Gedong Tengen',
          city: 'Kota Yogyakarta',
          state: 'Daerah Istimewa Yogyakarta',
          postcode: '55271',
        },
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const res = await service.reverseGeocode(-7.7956, 110.3695);
      expect(res.street).toBe('Jl. Malioboro');
      expect(res.kelurahan).toBe('Sosromenduran');
      expect(res.kecamatan).toBe('Gedong Tengen');
      expect(res.kota).toBe('Kota Yogyakarta');
      expect(res.provinsi).toBe('Daerah Istimewa Yogyakarta');
      expect(res.zip).toBe('55271');
      expect(res.latitude).toBe(-7.7956);
      expect(res.longitude).toBe(110.3695);
    });

    it('handles ISO province code fallback (ID-YO)', async () => {
      const mockResponse = {
        lat: '-7.7654',
        lon: '110.3789',
        display_name: 'Caturtunggal, Depok, Sleman',
        address: {
          road: 'Jl. Kaliurang KM 5',
          village: 'Caturtunggal',
          municipality: 'Depok',
          county: 'Kabupaten Sleman',
          'ISO3166-2-lvl4': 'ID-YO',
        },
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const res = await service.reverseGeocode(-7.7654, 110.3789);
      expect(res.street).toBe('Jl. Kaliurang KM 5');
      expect(res.kelurahan).toBe('Caturtunggal');
      expect(res.kecamatan).toBe('Depok');
      expect(res.kota).toBe('Kabupaten Sleman');
      expect(res.provinsi).toBe('Daerah Istimewa Yogyakarta');
    });

    it('throws error when coordinates are invalid', async () => {
      await expect(service.reverseGeocode(100, 200)).rejects.toThrow(
        'Koordinat tidak valid'
      );
    });
  });

  describe('searchPlaces', () => {
    it('returns empty array when query is too short', async () => {
      const res = await service.searchPlaces('yo');
      expect(res).toEqual([]);
    });

    it('returns formatted search results', async () => {
      const mockSearchData = [
        {
          place_id: 12345,
          lat: '-7.7712',
          lon: '110.3687',
          display_name:
            'Hotel Tentrem Yogyakarta, Jl. P. Mangkubumi, Cokrodiningratan, Jetis, Yogyakarta',
          name: 'Hotel Tentrem Yogyakarta',
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockSearchData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const res = await service.searchPlaces('Hotel Tentrem');
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('12345');
      expect(res[0].name).toBe('Hotel Tentrem Yogyakarta');
      expect(res[0].latitude).toBe(-7.7712);
      expect(res[0].longitude).toBe(110.3687);
    });

    it('returns formatted search results from Google Places API (New)', async () => {
      const prevKey = process.env.GOOGLE_MAPS_API_KEY;
      process.env.GOOGLE_MAPS_API_KEY = 'test-places-api-key';

      const mockGooglePlacesData = {
        places: [
          {
            id: 'ChIJ4S1NXUhYei4RBvAQ2FBkmFk',
            displayName: { text: 'Hotel Tentrem Yogyakarta' },
            formattedAddress:
              'Jl. P. Mangkubumi No.72A, Cokrodiningratan, Kec. Jetis, Kota Yogyakarta',
            location: {
              latitude: -7.7738,
              longitude: 110.3685,
            },
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockGooglePlacesData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      try {
        const res = await service.searchPlaces('Hotel Tentrem');
        expect(res).toHaveLength(1);
        expect(res[0].id).toBe('ChIJ4S1NXUhYei4RBvAQ2FBkmFk');
        expect(res[0].name).toBe('Hotel Tentrem Yogyakarta');
        expect(res[0].address).toContain('Jl. P. Mangkubumi');
        expect(res[0].latitude).toBe(-7.7738);
        expect(res[0].longitude).toBe(110.3685);
      } finally {
        process.env.GOOGLE_MAPS_API_KEY = prevKey;
      }
    });
  });
});
