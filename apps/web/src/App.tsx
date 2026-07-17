import { AppProviders } from '@/app/AppProviders';
import { AppRouter } from '@/app/AppRouter';
import { AdSenseScript } from '@/components/ads/AdSenseScript';
import {
  CookieConsent,
  hasAdsConsent,
} from '@/features/legal/components/CookieConsent';

function App() {
  // Only load AdSense if user has consented to ads
  const adsConsent = hasAdsConsent();

  return (
    <AppProviders>
      <AdSenseScript enabled={adsConsent} />
      <AppRouter />
      <CookieConsent />
    </AppProviders>
  );
}

export default App;
