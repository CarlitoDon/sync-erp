/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SYNC_ERP_API_URL?: string;
  readonly VITE_GOOGLE_ADSENSE_CLIENT_ID?: string;
  readonly VITE_GOOGLE_ADSENSE_ENABLED?: string;
  readonly VITE_GOOGLE_ADSENSE_AUTO_ADS_ENABLED?: string;
  readonly VITE_GOOGLE_ADSENSE_DEFAULT_SLOT?: string;
  readonly VITE_GOOGLE_ADSENSE_FOOTER_SLOT?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_ENABLED?: string;
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  readonly VITE_SENTRY_RELEASE?: string;
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE?: string;
  readonly VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
