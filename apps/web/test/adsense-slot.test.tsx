import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdSenseSlot } from '../src/components/ads/AdSenseSlot';

describe('AdSenseSlot', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_ADSENSE_ENABLED', 'true');
    window.adsbygoogle = [];
  });

  afterEach(() => {
    cleanup();
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
});
