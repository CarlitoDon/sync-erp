import { ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/contexts/AuthContext';
import { CompanyProvider } from '@/contexts/CompanyContext';
import { SidebarProvider } from '@/contexts/SidebarContext';
import { ConfirmProvider } from '@/components/ui/ConfirmModal';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CompanyProvider>
        <SidebarProvider>
          <ConfirmProvider>
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
          </ConfirmProvider>
        </SidebarProvider>
      </CompanyProvider>
    </AuthProvider>
  );
}
