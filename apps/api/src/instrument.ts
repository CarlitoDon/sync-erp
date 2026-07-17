import './env';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

const DEFAULT_TRACES_SAMPLE_RATE = 0.05;
const DEFAULT_PROFILES_SAMPLE_RATE = 0;

let sentryInitialized = false;

function parseSampleRate(envKey: string, fallback: number): number {
  const rawValue = process.env[envKey];
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
  return Boolean(process.env.SENTRY_DSN) && process.env.SENTRY_ENABLED !== 'false';
}

export function initSentry(): void {
  if (sentryInitialized || !isSentryConfigured()) {
    if (process.env.SENTRY_ENABLED === 'true' && !process.env.SENTRY_DSN) {
      console.warn('[Sentry] SENTRY_ENABLED=true but SENTRY_DSN is not set; skipping init.');
    }
    return;
  }

  const environment =
    process.env.SENTRY_ENVIRONMENT ||
    process.env.HOSTINGER_ENV ||
    process.env.NODE_ENV ||
    'development';

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment,
    release: process.env.SENTRY_RELEASE,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: parseSampleRate(
      'SENTRY_TRACES_SAMPLE_RATE',
      DEFAULT_TRACES_SAMPLE_RATE
    ),
    profilesSampleRate: parseSampleRate(
      'SENTRY_PROFILES_SAMPLE_RATE',
      DEFAULT_PROFILES_SAMPLE_RATE
    ),
  });

  sentryInitialized = true;
  console.warn(`[Sentry] API error tracking enabled for ${environment}.`);
}

initSentry();

export { Sentry };
