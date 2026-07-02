function normalizeEnvValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function getAdSenseClientId(): string | undefined {
  return normalizeEnvValue(
    import.meta.env.VITE_GOOGLE_ADSENSE_CLIENT_ID
  );
}

export function getDefaultAdSenseSlot(): string | undefined {
  return normalizeEnvValue(
    import.meta.env.VITE_GOOGLE_ADSENSE_DEFAULT_SLOT
  );
}

export function getFooterAdSenseSlot(): string | undefined {
  return (
    normalizeEnvValue(
      import.meta.env.VITE_GOOGLE_ADSENSE_FOOTER_SLOT
    ) ??
    getDefaultAdSenseSlot()
  );
}

export function isAdSenseEnvEnabled(): boolean {
  return (
    normalizeEnvValue(import.meta.env.VITE_GOOGLE_ADSENSE_ENABLED) ===
    'true'
  );
}

export function isAutoAdsEnabled(): boolean {
  return (
    normalizeEnvValue(
      import.meta.env.VITE_GOOGLE_ADSENSE_AUTO_ADS_ENABLED
    ) === 'true'
  );
}
