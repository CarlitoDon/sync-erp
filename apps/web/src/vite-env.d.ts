/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_GOOGLE_ADSENSE_CLIENT_ID?: string;
  readonly VITE_GOOGLE_ADSENSE_ENABLED?: string;
  readonly VITE_GOOGLE_ADSENSE_DEFAULT_SLOT?: string;
  readonly VITE_GOOGLE_ADSENSE_FOOTER_SLOT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
