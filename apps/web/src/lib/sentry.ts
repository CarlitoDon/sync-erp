import * as Sentry from '@sentry/react';

const DEFAULT_TRACES_SAMPLE_RATE = 0.05;
const DEFAULT_REPLAYS_ON_ERROR_SAMPLE_RATE = 0.1;

let sentryInitialized = false;

function parseSampleRate(envKey: keyof ImportMetaEnv, fallback: number): number {
  const rawValue = import.meta.env[envKey];
  if (!rawValue) return fallback;

  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    console.warn(
      `[Sentry] Ignoring invalid ${envKey}; expected a number between 0 and 1.`
    );
    return fallback;
  }

  return value;
}

export function isSentryConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SENTRY_DSN) &&
    import.meta.env.VITE_SENTRY_ENABLED !== 'false';
}

export function initSentry(): void {
  if (sentryInitialized || !isSentryConfigured()) {
    if (
      import.meta.env.VITE_SENTRY_ENABLED === 'true' &&
      !import.meta.env.VITE_SENTRY_DSN
    ) {
      console.warn('[Sentry] VITE_SENTRY_ENABLED=true but VITE_SENTRY_DSN is not set; skipping init.');
    }
    return;
  }

  const environment =
    import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE;

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment,
    release: import.meta.env.VITE_SENTRY_RELEASE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: parseSampleRate(
      'VITE_SENTRY_TRACES_SAMPLE_RATE',
      DEFAULT_TRACES_SAMPLE_RATE
    ),
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: parseSampleRate(
      'VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE',
      DEFAULT_REPLAYS_ON_ERROR_SAMPLE_RATE
    ),
  });

  sentryInitialized = true;
}

export { Sentry };
