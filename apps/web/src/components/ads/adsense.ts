export function getAdSenseClientId(): string | undefined {
  return import.meta.env.VITE_GOOGLE_ADSENSE_CLIENT_ID;
}

export function getDefaultAdSenseSlot(): string | undefined {
  return import.meta.env.VITE_GOOGLE_ADSENSE_DEFAULT_SLOT;
}

export function getFooterAdSenseSlot(): string | undefined {
  return (
    import.meta.env.VITE_GOOGLE_ADSENSE_FOOTER_SLOT ??
    getDefaultAdSenseSlot()
  );
}

export function isAdSenseEnvEnabled(): boolean {
  return import.meta.env.VITE_GOOGLE_ADSENSE_ENABLED === 'true';
}
