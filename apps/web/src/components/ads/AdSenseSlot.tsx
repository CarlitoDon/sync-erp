import { useEffect } from 'react';
import {
  getAdSenseClientId,
  getDefaultAdSenseSlot,
  isAdSenseEnvEnabled,
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
  const shouldRender =
    enabled &&
    isAdSenseEnvEnabled() &&
    Boolean(resolvedClientId) &&
    Boolean(resolvedSlot);

  useEffect(() => {
    if (!shouldRender) return;

    try {
      window.adsbygoogle = window.adsbygoogle ?? [];
      window.adsbygoogle.push({});
    } catch {
      // AdSense can fail before the remote script is ready; the slot remains inert.
    }
  }, [shouldRender, resolvedSlot]);

  if (!shouldRender || !resolvedClientId || !resolvedSlot) {
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
