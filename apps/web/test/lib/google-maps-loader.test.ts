/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadGoogleMaps,
  resetGoogleMapsLoaderForTests,
} from '@/lib/google-maps-loader';

describe('loadGoogleMaps', () => {
  beforeEach(() => {
    resetGoogleMapsLoaderForTests();
    Reflect.deleteProperty(window, 'google');
  });

  afterEach(() => {
    resetGoogleMapsLoaderForTests();
    vi.useRealTimers();
    Reflect.deleteProperty(window, 'google');
  });

  it('loads the official Google Maps JavaScript endpoint asynchronously', async () => {
    const importLibrary = vi.fn((library: string) =>
      Promise.resolve(
        library === 'maps' ? { Map: class {} } : { Marker: class {} }
      )
    );
    const promise = loadGoogleMaps();
    const script = document.getElementById(
      'sync-erp-google-maps-js'
    ) as HTMLScriptElement;

    expect(script).not.toBeNull();
    expect(script.src).toContain('https://maps.googleapis.com/maps/api/js?');
    expect(new URL(script.src).searchParams.get('libraries')).toBe(
      'maps,marker,places'
    );
    expect(script.src).toContain('loading=async');
    expect(script.src).toContain('callback=__syncErpGoogleMapsCallback_');
    expect(script.src).toContain('auth_referrer_policy=origin');

    const mockGoogle = {
      maps: {
        importLibrary,
        Map: class {},
        Marker: class {},
      } as unknown as typeof google.maps,
    };
    (window as unknown as { google: typeof mockGoogle }).google = mockGoogle;

    const callbackName = new URL(script.src).searchParams.get(
      'callback'
    ) as string;
    (
      window as unknown as Record<string, (() => void) | undefined>
    )[callbackName]!();

    await expect(promise).resolves.toBe(mockGoogle.maps);
    expect(importLibrary).toHaveBeenCalledWith('maps');
    expect(importLibrary).toHaveBeenCalledWith('marker');
  });

  it('times out, cleans up, and permits a retry when the script never settles', async () => {
    vi.useFakeTimers();

    const firstScript = document.getElementById('sync-erp-google-maps-js');
    expect(firstScript).toBeNull();
    const firstLoad = expect(loadGoogleMaps()).rejects.toMatchObject({
      code: 'LOAD_FAILED',
    });
    const pendingScript = document.getElementById('sync-erp-google-maps-js');
    expect(pendingScript).not.toBeNull();

    await vi.advanceTimersByTimeAsync(10_000);
    await firstLoad;
    expect(document.getElementById('sync-erp-google-maps-js')).toBeNull();

    const retry = loadGoogleMaps();
    const retryScript = document.getElementById(
      'sync-erp-google-maps-js'
    ) as HTMLScriptElement;
    expect(retryScript).not.toBe(pendingScript);
    const importLibrary = vi.fn((library: string) =>
      Promise.resolve(
        library === 'maps' ? { Map: class {} } : { Marker: class {} }
      )
    );
    const mockGoogle = {
      maps: {
        importLibrary,
        Map: class {},
        Marker: class {},
      } as unknown as typeof google.maps,
    };
    (window as unknown as { google: typeof mockGoogle }).google = mockGoogle;

    const callbackName = new URL(retryScript.src).searchParams.get(
      'callback'
    ) as string;
    (
      window as unknown as Record<string, (() => void) | undefined>
    )[callbackName]!();

    await expect(retry).resolves.toBe(mockGoogle.maps);
  });
});
