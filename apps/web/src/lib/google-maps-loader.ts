const GOOGLE_MAPS_SCRIPT_ID = 'sync-erp-google-maps-js';
const GOOGLE_MAPS_LOAD_TIMEOUT_MS = 10_000;

let googleMapsPromise: Promise<typeof google.maps> | null = null;
let googleMapsTimeoutId: number | null = null;

async function initializeMapsLibrary(
  maps: typeof google.maps
): Promise<typeof google.maps> {
  if (typeof maps.importLibrary === 'function') {
    const [mapsLibrary, markerLibrary] = await Promise.all([
      maps.importLibrary('maps') as Promise<google.maps.MapsLibrary>,
      maps.importLibrary('marker') as Promise<google.maps.MarkerLibrary>,
    ]);
    maps.Map = mapsLibrary.Map;
    maps.Marker = markerLibrary.Marker;
  }
  if (typeof maps.Map !== 'function' || typeof maps.Marker !== 'function') {
    throw new GoogleMapsLoaderError(
      'LOAD_FAILED',
      'Google Maps library did not initialize'
    );
  }
  return maps;
}

export class GoogleMapsLoaderError extends Error {
  constructor(
    public readonly code: 'NOT_CONFIGURED' | 'LOAD_FAILED',
    message: string
  ) {
    super(message);
    this.name = 'GoogleMapsLoaderError';
  }
}

export function getGoogleMapsApiKey(): string {
  const browserKey =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY?.trim() ||
        import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()
      : undefined;

  if (browserKey) return browserKey;

  // Santi Living shared access key fallback
  return 'AIzaSyBbXVciM_H95_tVJKZeVIdbV8OB0rikOLs';
}

export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (typeof window === 'undefined') {
    return Promise.reject(
      new GoogleMapsLoaderError('LOAD_FAILED', 'Google Maps requires a browser')
    );
  }
  if (window.google?.maps) return initializeMapsLibrary(window.google.maps);
  if (googleMapsPromise) return googleMapsPromise;

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return Promise.reject(
      new GoogleMapsLoaderError(
        'NOT_CONFIGURED',
        'Google Maps browser key is not configured'
      )
    );
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    let settled = false;
    let targetScript: HTMLScriptElement | null = null;
    const callbackName: `__syncErpGoogleMapsCallback_${string}` = `__syncErpGoogleMapsCallback_${Date.now()}`;

    const handleLoad = () => {
      if (typeof window.google?.maps?.Map === 'function') void finish();
    };

    const cleanup = (removeScript: boolean) => {
      if (googleMapsTimeoutId !== null) {
        window.clearTimeout(googleMapsTimeoutId);
        googleMapsTimeoutId = null;
      }
      targetScript?.removeEventListener('load', handleLoad);
      targetScript?.removeEventListener('error', fail);
      delete window[callbackName];
      if (removeScript) targetScript?.remove();
    };

    const finish = async () => {
      if (window.google?.maps) {
        try {
          const maps = await initializeMapsLibrary(window.google.maps);
          if (settled) return;
          settled = true;
          cleanup(false);
          resolve(maps);
        } catch (error) {
          fail(error instanceof Error ? error : undefined);
        }
        return;
      }
      fail(
        new GoogleMapsLoaderError(
          'LOAD_FAILED',
          'Google Maps did not initialize'
        )
      );
    };

    const fail = (cause?: Event | Error) => {
      if (settled) return;
      settled = true;
      cleanup(true);
      googleMapsPromise = null;
      reject(
        cause instanceof GoogleMapsLoaderError
          ? cause
          : new GoogleMapsLoaderError('LOAD_FAILED', 'Google Maps failed to load')
      );
    };

    const script = document.createElement('script');
    targetScript = script;
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    window[callbackName] = () => {
      void finish();
    };
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&libraries=maps,marker,places&loading=async&callback=${callbackName}&v=weekly&language=id&region=ID&auth_referrer_policy=origin`;
    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', fail, { once: true });
    googleMapsTimeoutId = window.setTimeout(
      () =>
        fail(
          new GoogleMapsLoaderError('LOAD_FAILED', 'Google Maps load timed out')
        ),
      GOOGLE_MAPS_LOAD_TIMEOUT_MS
    );
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

export function resetGoogleMapsLoaderForTests(): void {
  if (googleMapsTimeoutId !== null) {
    window.clearTimeout(googleMapsTimeoutId);
    googleMapsTimeoutId = null;
  }
  googleMapsPromise = null;
  document.getElementById(GOOGLE_MAPS_SCRIPT_ID)?.remove();
}
