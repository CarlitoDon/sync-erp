import { ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/contexts/AuthContext';
import { CompanyProvider } from '@/contexts/CompanyContext';
import { SidebarProvider } from '@/contexts/SidebarContext';
import { ConfirmProvider } from '@/components/ui/ConfirmModal';
import { PromptProvider } from '@/components/ui/PromptModal';
import { TRPCProvider } from '@/lib/trpcProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <TRPCProvider>
        <AuthProvider>
          <CompanyProvider>
            <SidebarProvider>
              <ConfirmProvider>
                <PromptProvider>
                  {children}
                  <Toaster
                position="top-right"
                toastOptions={{
                  duration: 3000,
                  style: {
                    background: '#363636',
                    color: '#fff',
                  },
                  success: {
                    style: {
                      background: '#10b981',
                    },
                  },
                  error: {
                    style: {
                      background: '#ef4444',
                    },
                  },
                }}
              />
                </PromptProvider>
            </ConfirmProvider>
          </SidebarProvider>
        </CompanyProvider>
      </AuthProvider>
    </TRPCProvider>
    </ErrorBoundary>
  );
}
