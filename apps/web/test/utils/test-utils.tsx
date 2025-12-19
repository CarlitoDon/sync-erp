import React, { ReactElement } from 'react';
import {
  render,
  RenderOptions,
  RenderResult,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '@/app/AppProviders';
import userEvent from '@testing-library/user-event';

interface ExtendedRenderOptions extends Omit<
  RenderOptions,
  'wrapper'
> {
  route?: string;
}

// Wrapper component that includes all providers
// MemoryRouter is used for testing navigation
// Wrapper component that includes all providers
// MemoryRouter is used for testing navigation
const AllTheProviders = ({
  children,
  route,
}: {
  children: React.ReactNode;
  route: string;
}) => {
  return (
    <MemoryRouter initialEntries={[route]}>
      <AppProviders>{children}</AppProviders>
    </MemoryRouter>
  );
};

const renderWithContext = (
  ui: ReactElement,
  options?: ExtendedRenderOptions
): RenderResult & { user: ReturnType<typeof userEvent.setup> } => {
  const route = options?.route || '/';

  return {
    user: userEvent.setup(),
    ...render(ui, {
      wrapper: ({ children }) => (
        <AllTheProviders route={route}>{children}</AllTheProviders>
      ),
      ...options,
    }),
  };
};

// Re-export everything from RTL
export * from '@testing-library/react';
export { renderWithContext, userEvent };
