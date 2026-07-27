import { useEffect } from 'react';
import {
  getAdSenseClientId,
  getDefaultAdSenseSlot,
  isAdSenseEnvEnabled,
  isAutoAdsEnabled,
} from './adsense';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

interface AdSenseSlotProps {
  enabled: boolean;
  slot?: string;
  clientId?: string;
  className?: string;
}

export function AdSenseSlot({
  enabled,
  slot,
  clientId,
  className = '',
}: AdSenseSlotProps) {
  const resolvedClientId = clientId ?? getAdSenseClientId();
  const resolvedSlot = slot ?? getDefaultAdSenseSlot();
  const autoAds = isAutoAdsEnabled();
  const hasSlot = Boolean(resolvedSlot);
  const canRenderLiveAd =
    enabled &&
    isAdSenseEnvEnabled() &&
    Boolean(resolvedClientId) &&
    (hasSlot || autoAds);

  useEffect(() => {
    if (!canRenderLiveAd || !hasSlot) return;

    try {
      window.adsbygoogle = window.adsbygoogle ?? [];
      window.adsbygoogle.push({});
    } catch {
      // AdSense can fail before the remote script is ready; the slot remains inert.
    }
  }, [canRenderLiveAd, resolvedSlot, hasSlot]);

  if (!enabled) {
    return null;
  }

  if (!canRenderLiveAd) {
    return (
      <div
        aria-label="Advertisement"
        className={`rounded-lg border border-dashed border-slate-300 bg-slate-50/80 p-4 text-center ${className}`}
        data-sync-erp-ad-placeholder="true"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Ad-supported Free plan
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Mock ad slot. Live ads stay disabled until Google AdSense
          env values are configured.
        </p>
      </div>
    );
  }

  // Auto Ads only needs the site-wide script. Google chooses and injects
  // placements itself, so reserving an empty manual slot creates dead space.
  if (autoAds && !hasSlot) {
    return null;
  }

  if (!resolvedSlot) {
    return null;
  }

  return (
    <div
      aria-label="Advertisement"
      className={`rounded-lg border border-gray-200 bg-white/70 p-2 text-center ${className}`}
    >
      <ins
        className="adsbygoogle block"
        data-ad-client={resolvedClientId}
        data-ad-format="auto"
        data-ad-slot={resolvedSlot}
        data-full-width-responsive="true"
        style={{ display: 'block' }}
      />
    </div>
  );
}
