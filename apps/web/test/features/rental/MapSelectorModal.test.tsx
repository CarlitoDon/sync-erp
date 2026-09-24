import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import MapSelectorModal, {
  extractLatLngCoord,
} from '@/features/rental/modals/MapSelectorModal';

const mockExtractFromUrlMutateAsync = vi.fn();
const mockReverseGeocodeFetch = vi.fn();
let mockSearchPlacesData: Array<{
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}> = [];

vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({
      maps: {
        reverseGeocode: { fetch: mockReverseGeocodeFetch },
      },
    }),
    maps: {
      extractFromUrl: {
        useMutation: () => ({
          mutateAsync: mockExtractFromUrlMutateAsync,
          isPending: false,
        }),
      },
      searchPlaces: {
        useQuery: () => ({
          data: mockSearchPlacesData,
          isFetching: false,
        }),
      },
    },
  },
}));

describe('MapSelectorModal (Google Maps SDK Full)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchPlacesData = [];
    mockReverseGeocodeFetch.mockResolvedValue({
      street: 'Jl. Malioboro No. 10',
      kelurahan: 'Sosromenduran',
      kecamatan: 'Gedong Tengen',
      kota: 'Kota Yogyakarta',
      provinsi: 'Daerah Istimewa Yogyakarta',
      zip: '55271',
      fullAddress:
        'Jl. Malioboro No. 10, Sosromenduran, Gedong Tengen, Kota Yogyakarta, Daerah Istimewa Yogyakarta 55271',
      latitude: -7.7956,
      longitude: 110.3695,
    });
  });

  it('renders Google Maps picker modal with inputs and controls', () => {
    render(
      <MapSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        initialCoords={{ lat: -7.7956, lng: 110.3695 }}
      />
    );

    expect(
      screen.getByText('Pilih Titik Lokasi Pengantaran (Peta)')
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/contoh: hotel tentrem, malioboro/i)
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/maps\.app\.goo\.gl/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ekstrak/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /lokasi saya/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /gunakan lokasi ini/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /batal/i })).toBeInTheDocument();
  });

  it('allows extracting coordinates and address from Google Maps link', async () => {
    mockExtractFromUrlMutateAsync.mockResolvedValueOnce({
      latitude: -7.7738,
      longitude: 110.3685,
      street: 'Jl. P. Mangkubumi No. 72A',
      kelurahan: 'Cokrodiningratan',
      kecamatan: 'Jetis',
      kota: 'Kota Yogyakarta',
      provinsi: 'Daerah Istimewa Yogyakarta',
      zip: '55233',
      fullAddress: 'Hotel Tentrem Yogyakarta, Jl. P. Mangkubumi No. 72A',
    });

    render(
      <MapSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    const linkInput = screen.getByPlaceholderText(/maps\.app\.goo\.gl/i);
    fireEvent.change(linkInput, {
      target: { value: 'https://maps.app.goo.gl/sample123' },
    });

    const extractBtn = screen.getByRole('button', { name: /ekstrak/i });
    await waitFor(() => {
      expect(extractBtn).toBeEnabled();
    });
    fireEvent.click(extractBtn);

    await waitFor(() => {
      expect(mockExtractFromUrlMutateAsync).toHaveBeenCalledWith({
        url: 'https://maps.app.goo.gl/sample123',
      });
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Jl. P. Mangkubumi No. 72A')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Cokrodiningratan')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Jetis')).toBeInTheDocument();
    });
  });

  it('selects search result and populates coordinates', async () => {
    mockSearchPlacesData = [
      {
        id: 'place_tentrem',
        name: 'Hotel Tentrem',
        address: 'Jl. P. Mangkubumi No. 72A, Yogyakarta',
        latitude: -7.7738,
        longitude: 110.3685,
      },
    ];

    render(
      <MapSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(/contoh: hotel tentrem, malioboro/i);
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: 'Tentrem' } });

    await waitFor(() => {
      expect(screen.getByText('Hotel Tentrem')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Hotel Tentrem'));

    await waitFor(() => {
      expect(mockReverseGeocodeFetch).toHaveBeenCalledWith({
        latitude: -7.7738,
        longitude: 110.3685,
      });
    });
  });

  it('triggers device geolocation when "Lokasi Saya" is clicked', async () => {
    const mockGetCurrentPosition = vi.fn((success) => {
      success({
        coords: {
          latitude: -7.789,
          longitude: 110.365,
        },
      });
    });

    const geolocationMock = {
      getCurrentPosition: mockGetCurrentPosition,
    };
    Object.defineProperty(navigator, 'geolocation', {
      value: geolocationMock,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window.navigator, 'geolocation', {
      value: geolocationMock,
      configurable: true,
      writable: true,
    });

    render(
      <MapSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    const myLocationBtn = screen.getByRole('button', { name: /lokasi saya/i });
    fireEvent.click(myLocationBtn);

    expect(mockGetCurrentPosition).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockReverseGeocodeFetch).toHaveBeenCalledWith({
        latitude: -7.789,
        longitude: 110.365,
      });
    });
  });

  it('submits selected location data on confirm and closes modal', async () => {
    const handleSelect = vi.fn();
    const handleClose = vi.fn();

    render(
      <MapSelectorModal
        isOpen={true}
        onClose={handleClose}
        onSelect={handleSelect}
        initialCoords={{ lat: -7.7956, lng: 110.3695 }}
      />
    );

    // Wait for initial reverse geocode
    await waitFor(() => {
      expect(mockReverseGeocodeFetch).toHaveBeenCalledWith({
        latitude: -7.7956,
        longitude: 110.3695,
      });
    });

    const confirmBtn = screen.getByRole('button', { name: /gunakan lokasi ini/i });
    fireEvent.click(confirmBtn);

    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: -7.7956,
        longitude: 110.3695,
        street: 'Jl. Malioboro No. 10',
        kelurahan: 'Sosromenduran',
        kecamatan: 'Gedong Tengen',
        kota: 'Kota Yogyakarta',
        provinsi: 'Daerah Istimewa Yogyakarta',
        fullAddress: expect.stringContaining('Jl. Malioboro No. 10'),
      })
    );
    expect(handleClose).toHaveBeenCalled();
  });

  it('cancels modal when "Batal" is clicked', () => {
    const handleClose = vi.fn();

    render(
      <MapSelectorModal
        isOpen={true}
        onClose={handleClose}
        onSelect={vi.fn()}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /batal/i });
    fireEvent.click(cancelBtn);

    expect(handleClose).toHaveBeenCalled();
  });

  it('dynamically updates coordinates when initialCoords changes', async () => {
    const { rerender } = render(
      <MapSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        initialCoords={{ lat: -7.7956, lng: 110.3695 }}
      />
    );

    await waitFor(() => {
      expect(mockReverseGeocodeFetch).toHaveBeenCalledWith({
        latitude: -7.7956,
        longitude: 110.3695,
      });
    });

    // Rerender with different coordinates (e.g. from customer selection)
    rerender(
      <MapSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        initialCoords={{ lat: -7.7500, lng: 110.3800 }}
      />
    );

    await waitFor(() => {
      expect(mockReverseGeocodeFetch).toHaveBeenCalledWith({
        latitude: -7.7500,
        longitude: 110.3800,
      });
    });
  });

  it('preserves landmark name in street when search result is selected', async () => {
    mockSearchPlacesData = [
      {
        id: 'place_tentrem',
        name: 'Hotel Tentrem',
        address: 'Jl. P. Mangkubumi No. 72A, Yogyakarta',
        latitude: -7.7738,
        longitude: 110.3685,
      },
    ];

    render(
      <MapSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(/contoh: hotel tentrem, malioboro/i);
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: 'Tentrem' } });

    await waitFor(() => {
      expect(screen.getByText('Hotel Tentrem')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Hotel Tentrem'));

    await waitFor(() => {
      const streetInput = screen.getByPlaceholderText('Nama jalan atau patokan');
      expect(streetInput).toHaveValue('Hotel Tentrem');
    });
  });

  it('retains user coordinates on confirm even if reverse geocoding fails', async () => {
    mockReverseGeocodeFetch.mockRejectedValue(new Error('Network offline'));
    const handleSelect = vi.fn();

    render(
      <MapSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        onSelect={handleSelect}
        initialCoords={{ lat: -7.7800, lng: 110.3900 }}
      />
    );

    const confirmBtn = screen.getByRole('button', { name: /gunakan lokasi ini/i });
    fireEvent.click(confirmBtn);

    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: -7.7800,
        longitude: 110.3900,
      })
    );
  });

  it('selects first search result when Enter is pressed on search input', async () => {
    mockSearchPlacesData = [
      {
        id: 'place_tentrem',
        name: 'Hotel Tentrem',
        address: 'Jl. P. Mangkubumi No. 72A, Yogyakarta',
        latitude: -7.7738,
        longitude: 110.3685,
      },
    ];

    render(
      <MapSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(/contoh: hotel tentrem, malioboro/i);
    fireEvent.change(searchInput, { target: { value: 'Tentrem' } });

    await waitFor(() => {
      expect(screen.getByText('Hotel Tentrem')).toBeInTheDocument();
    });

    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(mockReverseGeocodeFetch).toHaveBeenCalledWith({
        latitude: -7.7738,
        longitude: 110.3685,
      });
    });
  });

  it('triggers extraction when Enter is pressed on link input', async () => {
    mockExtractFromUrlMutateAsync.mockResolvedValueOnce({
      latitude: -7.7738,
      longitude: 110.3685,
      street: 'Jl. P. Mangkubumi No. 72A',
      kelurahan: 'Cokrodiningratan',
      kecamatan: 'Jetis',
      kota: 'Kota Yogyakarta',
      provinsi: 'Daerah Istimewa Yogyakarta',
      zip: '55233',
      fullAddress: 'Hotel Tentrem Yogyakarta, Jl. P. Mangkubumi No. 72A',
    });

    render(
      <MapSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    const linkInput = screen.getByPlaceholderText(/maps\.app\.goo\.gl/i);
    fireEvent.change(linkInput, {
      target: { value: 'https://maps.app.goo.gl/sample123' },
    });
    fireEvent.keyDown(linkInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(mockExtractFromUrlMutateAsync).toHaveBeenCalledWith({
        url: 'https://maps.app.goo.gl/sample123',
      });
    });
  });

  it('does not duplicate administrative prefix if already present in reverse geocode', async () => {
    mockReverseGeocodeFetch.mockResolvedValueOnce({
      street: 'Jl. Kaliurang KM 5',
      kelurahan: 'Kelurahan Caturtunggal',
      kecamatan: 'Kecamatan Depok',
      kota: 'Kabupaten Sleman',
      provinsi: 'Daerah Istimewa Yogyakarta',
      zip: '55281',
      fullAddress: 'Jl. Kaliurang KM 5, Caturtunggal, Depok, Sleman',
      latitude: -7.7654,
      longitude: 110.3789,
    });

    const handleSelect = vi.fn();

    render(
      <MapSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        onSelect={handleSelect}
        initialCoords={{ lat: -7.7654, lng: 110.3789 }}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Kelurahan Caturtunggal')).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole('button', { name: /gunakan lokasi ini/i });
    fireEvent.click(confirmBtn);

    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        fullAddress: expect.not.stringContaining('Kel. Kelurahan'),
      })
    );
    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        fullAddress: expect.not.stringContaining('Kec. Kecamatan'),
      })
    );
  });

  it('clears stale address when reopened with new coordinates', async () => {
    const { rerender } = render(
      <MapSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        initialCoords={{ lat: -7.7956, lng: 110.3695 }}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Sosromenduran')).toBeInTheDocument();
    });

    // Close modal
    rerender(
      <MapSelectorModal
        isOpen={false}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        initialCoords={{ lat: -7.7956, lng: 110.3695 }}
      />
    );

    // Reopen modal with new coordinates and pending reverse geocode
    mockReverseGeocodeFetch.mockReturnValue(new Promise(() => {})); // Never resolves
    rerender(
      <MapSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        initialCoords={{ lat: -7.8000, lng: 110.4000 }}
      />
    );

    // Stale kelurahan should not be present
    expect(screen.queryByDisplayValue('Sosromenduran')).toBeNull();
  });

  it('applies default zIndex of z-[10000] so it sits above Select dropdowns (z-[9999])', () => {
    render(
      <MapSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('z-[10000]');
  });

  it('allows overriding zIndex when explicitly specified', () => {
    render(
      <MapSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        zIndex="z-[12000]"
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('z-[12000]');
  });

  it('extracts coordinates safely from LatLng function getters without unsafe casting', () => {
    const latLngObj = {
      lat: () => -7.7777,
      lng: () => 110.3777,
    };
    // Test both function getters
    const lat = extractLatLngCoord(
      latLngObj as unknown as google.maps.LatLng,
      'lat',
      0
    );
    const lng = extractLatLngCoord(
      latLngObj as unknown as google.maps.LatLng,
      'lng',
      0
    );

    expect(lat).toBe(-7.7777);
    expect(lng).toBe(110.3777);
  });

  it('extracts coordinates from numeric properties and falls back cleanly on invalid values', () => {
    const numericLatLng = {
      lat: -7.7555,
      lng: 110.3555,
    };
    const lat = extractLatLngCoord(
      numericLatLng as unknown as google.maps.LatLng,
      'lat',
      0
    );
    const lng = extractLatLngCoord(
      numericLatLng as unknown as google.maps.LatLng,
      'lng',
      0
    );

    expect(lat).toBe(-7.7555);
    expect(lng).toBe(110.3555);

    const invalidLatLng = {
      lat: Number.NaN,
      lng: 'invalid',
    };
    const fallbackLat = extractLatLngCoord(
      invalidLatLng as unknown as google.maps.LatLng,
      'lat',
      -7.999
    );
    const fallbackLng = extractLatLngCoord(
      invalidLatLng as unknown as google.maps.LatLng,
      'lng',
      110.999
    );

    expect(fallbackLat).toBe(-7.999);
    expect(fallbackLng).toBe(110.999);
  });
});


