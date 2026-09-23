import '@testing-library/jest-dom';

// Global mocks
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mocking IntersectionObserver
const IntersectionObserverMock = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  takeRecords: vi.fn(),
  unobserve: vi.fn(),
}));

vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);

// ScrollIntoView mock
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Mock Google Maps
class MockGoogleMap {
  center: unknown;
  zoom: number;
  constructor(_container: HTMLElement, options?: { center?: unknown; zoom?: number }) {
    this.center = options?.center;
    this.zoom = options?.zoom ?? 13;
  }
  panTo = vi.fn();
  setZoom = vi.fn();
  addListener = vi.fn();
}

class MockGoogleMarker {
  map: unknown;
  position: { lat: number; lng: number } | null = null;
  constructor(options?: { map?: unknown; position?: { lat: number; lng: number } }) {
    this.map = options?.map;
    this.position = options?.position ?? { lat: -7.797068, lng: 110.370529 };
  }
  setPosition = vi.fn((pos: { lat: number; lng: number }) => {
    this.position = pos;
  });
  getPosition = vi.fn(() => ({
    lat: () => this.position?.lat ?? -7.797068,
    lng: () => this.position?.lng ?? 110.370529,
  }));
  addListener = vi.fn();
  setMap = vi.fn();
}

const mockGoogle = {
  maps: {
    Map: MockGoogleMap,
    Marker: MockGoogleMarker,
    event: {
      clearInstanceListeners: vi.fn(),
      trigger: vi.fn(),
    },
    importLibrary: vi.fn(async (lib: string) => {
      if (lib === 'maps') return { Map: MockGoogleMap };
      if (lib === 'marker') return { Marker: MockGoogleMarker };
      return {};
    }),
  },
};

(window as unknown as { google: typeof mockGoogle }).google = mockGoogle;
