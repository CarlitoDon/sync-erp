import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdSenseScript } from '../src/components/ads/AdSenseScript';
import { AdSenseSlot } from '../src/components/ads/AdSenseSlot';
import { getFooterAdSenseSlot } from '../src/components/ads/adsense';

describe('AdSenseSlot', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_ADSENSE_ENABLED', 'true');
    window.adsbygoogle = [];
  });

  afterEach(() => {
    cleanup();
    document
      .querySelectorAll('script[data-sync-erp-adsense="true"]')
      .forEach((script) => script.remove());
    vi.unstubAllEnvs();
  });

  it('renders an ad slot when free-plan ads and env are enabled', () => {
    const { container } = render(
      <AdSenseSlot
        clientId="ca-pub-test"
        enabled
        slot="slot-1"
      />
    );

    expect(screen.getByLabelText('Advertisement')).toBeInTheDocument();
    expect(container.querySelector('.adsbygoogle')).toHaveAttribute(
      'data-ad-client',
      'ca-pub-test'
    );
    expect(container.querySelector('.adsbygoogle')).toHaveAttribute(
      'data-ad-slot',
      'slot-1'
    );
  });

  it('does not render for paid plans', () => {
    const { container } = render(
      <AdSenseSlot
        clientId="ca-pub-test"
        enabled={false}
        slot="slot-1"
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders a safe mock placeholder when env values are blank', () => {
    vi.stubEnv('VITE_GOOGLE_ADSENSE_CLIENT_ID', '   ');
    vi.stubEnv('VITE_GOOGLE_ADSENSE_DEFAULT_SLOT', 'slot-1');

    const { container } = render(<AdSenseSlot enabled />);

    expect(screen.getByLabelText('Advertisement')).toHaveAttribute(
      'data-sync-erp-ad-placeholder',
      'true'
    );
    expect(screen.getByText('Ad-supported Free plan')).toBeInTheDocument();
    expect(container.querySelector('.adsbygoogle')).not.toBeInTheDocument();
    expect(window.adsbygoogle).toHaveLength(0);
  });

  it('renders a safe mock placeholder when AdSense is disabled for local/demo environments', () => {
    vi.stubEnv('VITE_GOOGLE_ADSENSE_ENABLED', 'false');

    const { container } = render(
      <AdSenseSlot
        clientId="ca-pub-test"
        enabled
        slot="slot-1"
      />
    );

    expect(screen.getByLabelText('Advertisement')).toHaveAttribute(
      'data-sync-erp-ad-placeholder',
      'true'
    );
    expect(container.querySelector('.adsbygoogle')).not.toBeInTheDocument();
    expect(window.adsbygoogle).toHaveLength(0);
  });

  it('does not load the privacy-invasive AdSense script unless env is enabled', () => {
    vi.stubEnv('VITE_GOOGLE_ADSENSE_ENABLED', 'false');

    render(
      <AdSenseScript
        clientId="ca-pub-test"
        enabled
      />
    );

    expect(
      document.querySelector('script[data-sync-erp-adsense="true"]')
    ).not.toBeInTheDocument();
  });

  it('falls back to the default slot when footer slot is blank', () => {
    vi.stubEnv('VITE_GOOGLE_ADSENSE_DEFAULT_SLOT', 'slot-default');
    vi.stubEnv('VITE_GOOGLE_ADSENSE_FOOTER_SLOT', '  ');

    expect(getFooterAdSenseSlot()).toBe('slot-default');
  });
});
