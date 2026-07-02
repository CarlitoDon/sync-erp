import { useState, useEffect, useCallback } from 'react';

const CONSENT_KEY = 'sync-erp-cookie-consent';
const CONSENT_VERSION = '1'; // bump to re-prompt after policy changes

export type ConsentChoice = 'accepted' | 'rejected';

interface ConsentState {
  choice: ConsentChoice;
  version: string;
  timestamp: string;
}

function isConsentState(value: unknown): value is ConsentState {
  if (!value || typeof value !== 'object') return false;

  const choice = Reflect.get(value, 'choice');
  const version = Reflect.get(value, 'version');
  const timestamp = Reflect.get(value, 'timestamp');

  return (
    (choice === 'accepted' || choice === 'rejected') &&
    version === CONSENT_VERSION &&
    typeof timestamp === 'string'
  );
}

function readConsent(): ConsentState | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    return isConsentState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeConsent(choice: ConsentChoice): ConsentState {
  const state: ConsentState = {
    choice,
    version: CONSENT_VERSION,
    timestamp: new Date().toISOString(),
  };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(state));
  return state;
}

/**
 * Returns true if user has accepted ads/tracking consent.
 * Returns false if rejected or no choice yet.
 */
export function hasAdsConsent(): boolean {
  const consent = readConsent();
  return consent?.choice === 'accepted';
}

/**
 * Reset consent (for "manage preferences" link).
 */
export function resetConsent(): void {
  localStorage.removeItem(CONSENT_KEY);
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = readConsent();
    if (!consent) {
      // Small delay so banner doesn't flash on initial paint
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = useCallback(() => {
    writeConsent('accepted');
    setVisible(false);
    // Reload so AdSense script can pick up consent
    window.location.reload();
  }, []);

  const handleReject = useCallback(() => {
    writeConsent('rejected');
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-6 sm:pb-6">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-slate-950/15 via-slate-950/5 to-transparent" />
      <section
        aria-label="Cookie and privacy preferences"
        className="relative mx-auto max-w-5xl overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 shadow-2xl shadow-slate-950/20 ring-1 ring-slate-950/5 backdrop-blur-xl"
      >
        <div className="absolute inset-y-0 left-0 hidden w-1.5 bg-gradient-to-b from-cyan-400 via-emerald-400 to-slate-950 sm:block" />
        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-8 lg:p-6 lg:pl-8">
          <div className="flex min-w-0 gap-4">
            <div className="hidden h-11 w-11 flex-none items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100 sm:flex">
              <span aria-hidden="true" className="text-lg">
                ✦
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-slate-950">
                  Cookie & Privasi
                </h3>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                  kontrol tetap di kamu
                </span>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Cookie teknis dipakai agar Sync ERP berjalan stabil. Cookie
                iklan hanya dipakai untuk free tier dan bisa kamu tolak tanpa
                mengganggu fitur inti aplikasi.
              </p>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Detail lengkap ada di{' '}
                <a
                  href="/privacy"
                  className="font-semibold text-cyan-700 underline decoration-cyan-300 underline-offset-4 transition hover:text-cyan-900"
                >
                  Privacy Policy
                </a>{' '}
                dan{' '}
                <a
                  href="/terms"
                  className="font-semibold text-cyan-700 underline decoration-cyan-300 underline-offset-4 transition hover:text-cyan-900"
                >
                  Terms of Service
                </a>
                .
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:w-72 lg:grid-cols-1">
            <button
              type="button"
              onClick={handleAccept}
              className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
            >
              Terima Semua
            </button>
            <button
              type="button"
              onClick={handleReject}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
            >
              Tolak Cookie Iklan
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
