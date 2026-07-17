import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PhotoUploader from '../src/features/rental/components/PhotoUploader';

const billingState = vi.hoisted(() => ({
  mediaAccess: true,
}));

vi.mock('@/hooks/useBillingFeatures', () => ({
  useBillingFeatures: () => ({
    adsEnabled: false,
    currentPlan: null,
    currentPlanKey: null,
    isLoading: false,
    mediaAccess: billingState.mediaAccess,
  }),
}));

describe('PhotoUploader media access', () => {
  afterEach(() => {
    billingState.mediaAccess = true;
    cleanup();
  });

  it('hides all media UI when media access is disabled', () => {
    billingState.mediaAccess = false;

    const { container } = render(
      <PhotoUploader
        photos={['data:image/png;base64,test']}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders upload and preview UI when media access is enabled', () => {
    billingState.mediaAccess = true;

    render(
      <PhotoUploader
        photos={['data:image/png;base64,test']}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    expect(screen.getByAltText('Foto 1')).toBeInTheDocument();
    expect(screen.getByText('Foto')).toBeInTheDocument();
  });
});
