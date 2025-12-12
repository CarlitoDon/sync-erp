import React, { ReactElement } from 'react';
import {
  render,
  RenderOptions,
  RenderResult,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { CompanyProvider } from '../../src/contexts/CompanyContext';
import { SidebarProvider } from '../../src/contexts/SidebarContext';
import { ConfirmProvider } from '../../src/components/ConfirmModal';
import userEvent from '@testing-library/user-event';

interface ExtendedRenderOptions extends Omit<
  RenderOptions,
  'wrapper'
> {
  route?: string;
}

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
      <AuthProvider>
        <CompanyProvider>
          <SidebarProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
          </SidebarProvider>
        </CompanyProvider>
      </AuthProvider>
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
