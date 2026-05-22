import { useEffect } from 'react';
import {
  getAdSenseClientId,
  isAdSenseEnvEnabled,
} from './adsense';

interface AdSenseScriptProps {
  enabled: boolean;
  clientId?: string;
}

export function AdSenseScript({
  enabled,
  clientId,
}: AdSenseScriptProps) {
  const resolvedClientId = clientId ?? getAdSenseClientId();
  const shouldLoad =
    enabled && isAdSenseEnvEnabled() && Boolean(resolvedClientId);

  useEffect(() => {
    if (!shouldLoad || !resolvedClientId) return;

    const existingScript = document.querySelector(
      'script[data-sync-erp-adsense="true"]'
    );

    if (existingScript) return;

    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.syncErpAdsense = 'true';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
      resolvedClientId
    )}`;
    document.head.appendChild(script);
  }, [resolvedClientId, shouldLoad]);

  return null;
}
