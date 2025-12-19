import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
} from 'react';
import type { Company } from '@sync-erp/shared';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/contexts/AuthContext';

interface CompanyContextType {
  currentCompany: Company | null;
  companies: Company[];
  setCurrentCompany: (company: Company | null) => void;
  setCompanies: (companies: Company[]) => void;
  refreshCompanies: () => Promise<void>;
  isLoading: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(
  undefined
);

export function CompanyProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { isAuthenticated } = useAuth();

  // Use tRPC to fetch companies
  const {
    data: companies = [],
    isLoading,
    refetch,
  } = trpc.company.list.useQuery(undefined, {
    enabled: !!isAuthenticated,
  });

  const [currentCompany, _setCurrentCompanyState] =
    useState<Company | null>(null);

  // Wrapper to sync with localStorage
  const setCurrentCompany = useCallback((company: Company | null) => {
    _setCurrentCompanyState(company);
    if (company) {
      localStorage.setItem('currentCompanyId', company.id);
    } else {
      localStorage.removeItem('currentCompanyId');
    }
  }, []);

  // Effect to restore selection or update when companies load
  useEffect(() => {
    if (!isAuthenticated || isLoading) return;

    const savedId = localStorage.getItem('currentCompanyId');
    if (savedId) {
      const found = companies.find((c) => c.id === savedId);
      if (found) {
        _setCurrentCompanyState(found);
      } else if (companies.length > 0 && !currentCompany) {
        // Saved ID not found in list (maybe removed), or list reloaded.
        // Could select first one, or just clear.
        // localStorage.removeItem('currentCompanyId');
      }
    }
  }, [companies, isAuthenticated, isLoading]);

  return (
    <CompanyContext.Provider
      value={{
        currentCompany,
        companies,
        setCurrentCompany,
        setCompanies: () => {}, // No-op as query manages state now
        refreshCompanies: async () => {
          await refetch();
        },
        isLoading,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error(
      'useCompany must be used within a CompanyProvider'
    );
  }
  return context;
}
