import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OnboardingStep from '@/features/dashboard/components/OnboardingStep';
import type { OnboardingStep as OnboardingStepType } from '@/features/dashboard/types';

const step: OnboardingStepType = {
  id: 'add-products',
  title: 'Add products and services',
  description: 'Add your inventory to start creating orders.',
  targetPath: '/products',
  isCompleted: false,
  icon: '📦',
};

describe('OnboardingStep', () => {
  it('keeps navigation and the details toggle as separate controls', () => {
    render(
      <MemoryRouter>
        <OnboardingStep step={step} />
      </MemoryRouter>
    );

    const navigation = screen.getByRole('link', {
      name: /Add products and services/i,
    });
    const expandButton = screen.getByRole('button', {
      name: 'Expand details',
    });

    expect(navigation).toHaveAttribute('href', '/products');
    expect(navigation).not.toContainElement(expandButton);
    expect(expandButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(expandButton);

    const collapseButton = screen.getByRole('button', {
      name: 'Collapse details',
    });
    const details = screen.getByText(step.description).parentElement;

    expect(collapseButton).toHaveAttribute('aria-expanded', 'true');
    expect(collapseButton).toHaveAttribute(
      'aria-controls',
      'onboarding-step-add-products-details'
    );
    expect(details).toHaveAttribute(
      'id',
      'onboarding-step-add-products-details'
    );
  });
});
