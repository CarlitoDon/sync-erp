import { useState, useEffect, useRef, useCallback } from 'react';
import FormModal from '@/components/ui/FormModal';
import { trpc } from '@/lib/trpc';
import {
  MagnifyingGlassIcon,
  MapPinIcon,
  ArrowPathIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { loadGoogleMaps } from '@/lib/google-maps-loader';

export interface SelectedLocationData {
  latitude: number;
  longitude: number;
  street: string;
  kelurahan: string;
  kecamatan: string;
  kota: string;
  provinsi: string;
  zip: string;
  fullAddress: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (location: SelectedLocationData) => void;
  initialCoords?: { lat: number; lng: number } | null;
  zIndex?: string;
}

const DEFAULT_LAT = -7.797068;
const DEFAULT_LNG = 110.370529;

function formatKelurahan(val?: string): string {
  if (!val) return '';
  const trimmed = val.trim();
  return /^(kelurahan|desa|kel\.|ds\.)\s+/i.test(trimmed)
    ? trimmed
    : `Kel. ${trimmed}`;
}

function formatKecamatan(val?: string): string {
  if (!val) return '';
  const trimmed = val.trim();
  return /^(kecamatan|kec\.)\s+/i.test(trimmed)
    ? trimmed
    : `Kec. ${trimmed}`;
}

export function extractLatLngCoord(
  latLng: google.maps.LatLng,
  coord: 'lat' | 'lng',
  fallback: number
): number {
  const accessor = Reflect.get(latLng, coord);
  if (typeof accessor === 'function') {
    const val = Reflect.apply(accessor, latLng, []);
    if (typeof val === 'number' && !Number.isNaN(val)) return val;
  }
  if (typeof accessor === 'number' && !Number.isNaN(accessor)) {
    return accessor;
  }
  return fallback;
}

export default function MapSelectorModal({
  isOpen,
  onClose,
  onSelect,
  initialCoords,
  zIndex = 'z-[10000]',
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const mapsApiRef = useRef<typeof google.maps | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerInstanceRef = useRef<google.maps.Marker | null>(null);
  const geocodeSeqRef = useRef<number>(0);

  const initialLat = initialCoords?.lat ?? DEFAULT_LAT;
  const initialLng = initialCoords?.lng ?? DEFAULT_LNG;

  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: initialLat,
    lng: initialLng,
  });

  const [locationDetails, setLocationDetails] = useState<SelectedLocationData>({
    latitude: initialLat,
    longitude: initialLng,
    street: '',
    kelurahan: '',
    kecamatan: '',
    kota: '',
    provinsi: '',
    zip: '',
    fullAddress: '',
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [googleMapsUrlInput, setGoogleMapsUrlInput] = useState('');
  const [mapStatus, setMapStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Debounce search query to reduce upstream Places API requests
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowSearchResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const extractMutation = trpc.maps.extractFromUrl.useMutation();
  const { data: searchResults, isFetching: isSearching } =
    trpc.maps.searchPlaces.useQuery(
      { query: debouncedSearchQuery },
      {
        enabled: isOpen && debouncedSearchQuery.length >= 3,
        staleTime: 60000,
      }
    );

  const utils = trpc.useUtils();
  const utilsRef = useRef(utils);
  utilsRef.current = utils;

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reverse geocode with sequencing to prevent out-of-order race conditions
  const fetchAddressDetails = useCallback(
    async (lat: number, lng: number, preferredStreet?: string) => {
      const seq = ++geocodeSeqRef.current;
      if (isMountedRef.current) setIsGeocoding(true);
      try {
        const result = await utilsRef.current.maps.reverseGeocode.fetch({
          latitude: lat,
          longitude: lng,
        });
        if (!isMountedRef.current || seq !== geocodeSeqRef.current) return;
        if (result) {
          setLocationDetails((prev) => {
            const nextStreet =
              preferredStreet !== undefined
                ? preferredStreet
                : result.street || '';
            const nextFullAddress =
              preferredStreet &&
              !result.fullAddress
                .toLowerCase()
                .includes(preferredStreet.toLowerCase())
                ? `${preferredStreet}, ${result.fullAddress}`
                : result.fullAddress || prev.fullAddress;

            return {
              ...prev,
              ...result,
              street: nextStreet,
              fullAddress: nextFullAddress,
              latitude: result.latitude ?? lat,
              longitude: result.longitude ?? lng,
            };
          });
        }
      } catch (err) {
        console.warn('[MapSelectorModal] Gagal reverse geocode:', err);
      } finally {
        if (isMountedRef.current && seq === geocodeSeqRef.current) {
          setIsGeocoding(false);
        }
      }
    },
    []
  );

  const fetchAddressDetailsRef = useRef(fetchAddressDetails);
  fetchAddressDetailsRef.current = fetchAddressDetails;

  // Center update helper
  const updateSelectedPoint = useCallback(
    async (
      lat: number,
      lng: number,
      zoomLevel?: number,
      skipGeocode = false,
      preferredStreet?: string
    ) => {
      setCoords({ lat, lng });
      setLocationDetails((prev) => ({
        ...prev,
        latitude: lat,
        longitude: lng,
        ...(preferredStreet !== undefined ? { street: preferredStreet } : {}),
      }));
      if (markerInstanceRef.current) {
        markerInstanceRef.current.setPosition({ lat, lng });
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.panTo({ lat, lng });
        if (zoomLevel) {
          mapInstanceRef.current.setZoom(zoomLevel);
        }
      }
      if (!skipGeocode) {
        await fetchAddressDetailsRef.current(lat, lng, preferredStreet);
      }
    },
    []
  );

  const updateSelectedPointRef = useRef(updateSelectedPoint);
  updateSelectedPointRef.current = updateSelectedPoint;

  // Initialize or reset map when modal opens or coordinates update
  useEffect(() => {
    if (!isOpen) {
      setMapStatus('idle');
      geocodeSeqRef.current++;
      const maps = mapsApiRef.current;
      if (markerInstanceRef.current) {
        maps?.event.clearInstanceListeners(markerInstanceRef.current);
        markerInstanceRef.current.setMap(null);
        markerInstanceRef.current = null;
      }
      if (mapInstanceRef.current) {
        maps?.event.clearInstanceListeners(mapInstanceRef.current);
        mapInstanceRef.current = null;
      }
      mapsApiRef.current = null;
      return;
    }

    const targetLat = initialCoords?.lat ?? DEFAULT_LAT;
    const targetLng = initialCoords?.lng ?? DEFAULT_LNG;

    setCoords({ lat: targetLat, lng: targetLng });
    setLocationDetails({
      latitude: targetLat,
      longitude: targetLng,
      street: '',
      kelurahan: '',
      kecamatan: '',
      kota: '',
      provinsi: '',
      zip: '',
      fullAddress: '',
    });
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setGoogleMapsUrlInput('');
    setShowSearchResults(false);

    let isMounted = true;

    async function initMap() {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.panTo({ lat: targetLat, lng: targetLng });
        markerInstanceRef.current?.setPosition({
          lat: targetLat,
          lng: targetLng,
        });
        void fetchAddressDetailsRef.current(targetLat, targetLng);
        return;
      }

      setMapStatus('loading');
      let maps: typeof google.maps;
      try {
        maps = await loadGoogleMaps();
      } catch (err) {
        console.warn('[MapSelectorModal] Failed to load Google Maps:', err);
        if (isMounted) setMapStatus('error');
        return;
      }

      if (!isMounted || !mapContainerRef.current) return;
      mapsApiRef.current = maps;

      if (!mapInstanceRef.current) {
        const map = new maps.Map(mapContainerRef.current, {
          center: { lat: targetLat, lng: targetLng },
          zoom: 16,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'cooperative',
          clickableIcons: false,
        });

        const marker = new maps.Marker({
          map,
          position: { lat: targetLat, lng: targetLng },
          draggable: true,
          title: 'Titik Pengantaran',
        });

        marker.addListener('dragend', () => {
          const position = marker.getPosition();
          if (!position) return;
          const nextLat = extractLatLngCoord(position, 'lat', targetLat);
          const nextLng = extractLatLngCoord(position, 'lng', targetLng);
          void updateSelectedPointRef.current(nextLat, nextLng);
        });

        map.addListener('click', (event: google.maps.MapMouseEvent) => {
          if (!event.latLng) return;
          setShowSearchResults(false);
          const clickLat = extractLatLngCoord(event.latLng, 'lat', targetLat);
          const clickLng = extractLatLngCoord(event.latLng, 'lng', targetLng);
          void updateSelectedPointRef.current(clickLat, clickLng);
        });

        mapInstanceRef.current = map;
        markerInstanceRef.current = marker;

        window.requestAnimationFrame(() => {
          maps.event.trigger(map, 'resize');
        });
      }

      void fetchAddressDetailsRef.current(targetLat, targetLng);
      if (isMounted) setMapStatus('ready');
    }

    void initMap();

    return () => {
      isMounted = false;
    };
  }, [isOpen, initialCoords?.lat, initialCoords?.lng]);

  const handleDeviceLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Browser tidak mendukung geolokasi');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void updateSelectedPointRef.current(
          pos.coords.latitude,
          pos.coords.longitude,
          16
        );
        toast.success('Lokasi saat ini ditemukan');
      },
      () => {
        toast.error('Izin lokasi ditolak atau tidak tersedia');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleExtractFromUrl = async (overrideUrl?: string) => {
    const raw = (overrideUrl || googleMapsUrlInput).trim();
    if (!raw) return;

    // Invalidate any ongoing reverse geocoding
    geocodeSeqRef.current++;

    try {
      const extracted = await extractMutation.mutateAsync({
        url: raw,
      });
      if (extracted) {
        setLocationDetails({
          latitude: extracted.latitude,
          longitude: extracted.longitude,
          street: extracted.street || '',
          kelurahan: extracted.kelurahan || '',
          kecamatan: extracted.kecamatan || '',
          kota: extracted.kota || '',
          provinsi: extracted.provinsi || '',
          zip: extracted.zip || '',
          fullAddress: extracted.fullAddress || '',
        });
        setCoords({ lat: extracted.latitude, lng: extracted.longitude });
        if (markerInstanceRef.current) {
          markerInstanceRef.current.setPosition({
            lat: extracted.latitude,
            lng: extracted.longitude,
          });
        }
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo({
            lat: extracted.latitude,
            lng: extracted.longitude,
          });
          mapInstanceRef.current.setZoom(16);
        }
        toast.success('Lokasi berhasil diekstrak dari link!');
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Gagal mengekstrak titik koordinat dari link'
      );
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults && searchResults.length > 0) {
        handleSelectSearchResult(searchResults[0]);
      } else if (
        searchQuery.trim().startsWith('http://') ||
        searchQuery.trim().startsWith('https://') ||
        /^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/.test(searchQuery.trim())
      ) {
        setGoogleMapsUrlInput(searchQuery.trim());
        void handleExtractFromUrl(searchQuery.trim());
      }
    }
  };

  const handleUrlKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleExtractFromUrl();
    }
  };

  const handleSelectSearchResult = (result: {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  }) => {
    setShowSearchResults(false);
    setSearchQuery(result.name);
    setLocationDetails((prev) => ({
      ...prev,
      street: result.name,
      fullAddress: result.address,
      latitude: result.latitude,
      longitude: result.longitude,
    }));
    void updateSelectedPointRef.current(
      result.latitude,
      result.longitude,
      16,
      false,
      result.name
    );
  };

  const handleConfirm = () => {
    const parts = [
      locationDetails?.street,
      formatKelurahan(locationDetails?.kelurahan),
      formatKecamatan(locationDetails?.kecamatan),
      locationDetails?.kota,
      locationDetails?.provinsi,
    ].filter(Boolean);

    const fullAddress =
      parts.length > 0 ? parts.join(', ') : locationDetails?.fullAddress || '';

    onSelect({
      ...locationDetails,
      latitude: coords.lat,
      longitude: coords.lng,
      fullAddress,
    });
    onClose();
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Pilih Titik Lokasi Pengantaran (Peta)"
      maxWidth="2xl"
      zIndex={zIndex}
    >
      <div className="space-y-4">
        {/* Search bar & Extract bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Place Search */}
          <div ref={searchContainerRef} className="relative">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cari Nama Tempat / Alamat
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(true);
                }}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => setShowSearchResults(true)}
                placeholder="Contoh: Hotel Tentrem, Malioboro..."
                className="w-full pl-8 pr-8 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
              <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" />
              {isSearching && (
                <ArrowPathIcon className="w-4 h-4 text-primary-500 absolute right-2.5 top-2 animate-spin" />
              )}
            </div>

            {/* Results dropdown */}
            {showSearchResults &&
              searchResults &&
              searchResults.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
                  {searchResults.map((res) => (
                    <button
                      key={res.id}
                      type="button"
                      onClick={() => handleSelectSearchResult(res)}
                      className="w-full text-left p-2 hover:bg-slate-50 text-xs transition-colors flex items-start gap-2 cursor-pointer"
                    >
                      <MapPinIcon className="w-4 h-4 text-primary-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-slate-800">
                          {res.name}
                        </div>
                        <div className="text-slate-500 line-clamp-1">
                          {res.address}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
          </div>

          {/* Google Maps link paste */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Atau Tempel Link Google Maps
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={googleMapsUrlInput}
                onChange={(e) => setGoogleMapsUrlInput(e.target.value)}
                onKeyDown={handleUrlKeyDown}
                placeholder="https://maps.app.goo.gl/... atau koordinat"
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
              <button
                type="button"
                onClick={() => void handleExtractFromUrl()}
                disabled={
                  extractMutation.isPending || !googleMapsUrlInput.trim()
                }
                className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-700 disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer shrink-0"
              >
                {extractMutation.isPending ? (
                  <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ClipboardDocumentCheckIcon className="w-3.5 h-3.5" />
                )}
                Ekstrak
              </button>
            </div>
          </div>
        </div>

        {/* Google Map Container */}
        <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100">
          <div
            ref={mapContainerRef}
            className="w-full h-72 sm:h-80 z-0"
            style={{ minHeight: '280px' }}
          />

          <button
            type="button"
            onClick={handleDeviceLocation}
            className="absolute top-3 right-3 z-10 bg-white/95 hover:bg-white text-slate-700 border border-slate-200 px-2.5 py-1.5 rounded-lg shadow-sm text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer backdrop-blur-xs transition-colors"
          >
            <MapPinIcon className="w-4 h-4 text-emerald-600" />
            Lokasi Saya
          </button>

          {mapStatus === 'loading' && (
            <div className="absolute inset-0 z-10 bg-slate-50/70 backdrop-blur-2xs flex items-center justify-center text-xs font-medium text-slate-600 gap-2">
              <ArrowPathIcon className="w-4 h-4 animate-spin text-primary-600" />
              Memuat Google Maps...
            </div>
          )}

          {mapStatus === 'error' && (
            <div className="absolute inset-0 z-10 bg-rose-50/90 flex flex-col items-center justify-center text-xs text-rose-700 p-4 text-center">
              <p className="font-semibold mb-1">Google Maps tidak dapat dimuat</p>
              <p className="text-slate-600">
                Periksa koneksi internet atau gunakan pencarian alamat di atas.
              </p>
            </div>
          )}

          {isGeocoding && (
            <div className="absolute bottom-3 left-3 z-10 bg-slate-900/80 text-white px-3 py-1 rounded-full text-xs flex items-center gap-1.5 shadow">
              <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
              Mendeteksi alamat titik...
            </div>
          )}
        </div>

        {/* Structured Address Columns */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>Rincian Alamat Hasil Deteksi Peta</span>
            <span className="font-mono text-slate-500">
              {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div>
              <label className="block text-slate-500 mb-0.5">
                Alamat Jalan / Patokan
              </label>
              <input
                type="text"
                value={locationDetails?.street || ''}
                onChange={(e) =>
                  setLocationDetails((prev) => ({
                    ...prev,
                    street: e.target.value,
                  }))
                }
                placeholder="Nama jalan atau patokan"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-500 mb-0.5">
                Kelurahan / Desa
              </label>
              <input
                type="text"
                value={locationDetails?.kelurahan || ''}
                onChange={(e) =>
                  setLocationDetails((prev) => ({
                    ...prev,
                    kelurahan: e.target.value,
                  }))
                }
                placeholder="Kelurahan"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-500 mb-0.5">Kecamatan</label>
              <input
                type="text"
                value={locationDetails?.kecamatan || ''}
                onChange={(e) =>
                  setLocationDetails((prev) => ({
                    ...prev,
                    kecamatan: e.target.value,
                  }))
                }
                placeholder="Kecamatan"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-500 mb-0.5">
                Kabupaten / Kota
              </label>
              <input
                type="text"
                value={locationDetails?.kota || ''}
                onChange={(e) =>
                  setLocationDetails((prev) => ({
                    ...prev,
                    kota: e.target.value,
                  }))
                }
                placeholder="Kabupaten / Kota"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-800"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-500 mb-0.5">Provinsi</label>
              <input
                type="text"
                value={locationDetails?.provinsi || ''}
                onChange={(e) =>
                  setLocationDetails((prev) => ({
                    ...prev,
                    provinsi: e.target.value,
                  }))
                }
                placeholder="Provinsi"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 rounded-lg text-sm text-slate-700 hover:bg-gray-200 transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors inline-flex items-center gap-1.5"
          >
            <MapPinIcon className="w-4 h-4" />
            Gunakan Lokasi Ini
          </button>
        </div>
      </div>
    </FormModal>
  );
}
