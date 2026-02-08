import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
} from 'react';
import type { Company } from '@/types/api';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/contexts/AuthContext';

interface CompanyContextType {
  currentCompany: Company | null;
  companies: Company[];
  setCurrentCompany: (company: Company | null) => void;
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

  // Track if we've tried to restore from localStorage
  const [isInitialized, setIsInitialized] = useState(false);

  // Use tRPC to fetch companies
  const {
    data: companies = [],
    isLoading: queryLoading,
    refetch,
  } = trpc.company.list.useQuery(undefined, {
    enabled: !!isAuthenticated,
  });

  const [currentCompany, _setCurrentCompanyState] =
    useState<Company | null>(null);

  // Get tRPC utils for invalidating queries
  const utils = trpc.useUtils();

  // Wrapper to sync with localStorage and invalidate queries
  const setCurrentCompany = useCallback(
    (company: Company | null) => {
      _setCurrentCompanyState(company);
      if (company) {
        localStorage.setItem('currentCompanyId', company.id);
      } else {
        localStorage.removeItem('currentCompanyId');
      }
      // Invalidate all queries so they refetch with new company context
      utils.invalidate();
    },
    [utils]
  );

  // Effect to restore selection from localStorage when companies load
  useEffect(() => {
    // Skip if not authenticated or query still loading
    if (!isAuthenticated || queryLoading) return;

    // If no companies fetched yet, wait
    if (companies.length === 0) {
      // Edge case: user has no companies, mark as initialized
      setIsInitialized(true);
      return;
    }

    // If company already set, mark as initialized and done
    if (currentCompany) {
      setIsInitialized(true);
      return;
    }

    // Try to restore from localStorage
    const savedId = localStorage.getItem('currentCompanyId');
    if (savedId) {
      const found = companies.find((c) => c.id === savedId);
      if (found) {
        _setCurrentCompanyState(found);
      } else {
        // Saved company not found (maybe deleted), clear it
        localStorage.removeItem('currentCompanyId');
      }
    }

    // Mark as initialized regardless of whether we found a saved company
    setIsInitialized(true);
  }, [companies, isAuthenticated, queryLoading, currentCompany]);

  // Combined loading state: query loading OR not yet initialized
  const isLoading =
    queryLoading || (!isInitialized && isAuthenticated);

  return (
    <CompanyContext.Provider
      value={{
        currentCompany,
        companies,
        setCurrentCompany,
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
