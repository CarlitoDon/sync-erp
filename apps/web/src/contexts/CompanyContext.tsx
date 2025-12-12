import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
} from 'react';
import type { Company } from '@sync-erp/shared';
import { getCompanies } from '../services/companyService';
import { useAuth } from './AuthContext';

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
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [currentCompany, _setCurrentCompanyState] =
    useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Wrapper to sync with localStorage
  const setCurrentCompany = useCallback((company: Company | null) => {
    _setCurrentCompanyState(company);
    if (company) {
      localStorage.setItem('currentCompanyId', company.id);
    } else {
      localStorage.removeItem('currentCompanyId');
    }
  }, []);

  const refreshCompanies = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setIsLoading(true);
      const data = await getCompanies();
      setCompanies(data);

      // Restore selection from localStorage if possible
      const savedId = localStorage.getItem('currentCompanyId');
      if (savedId) {
        const found = data.find((c) => c.id === savedId);
        if (found) {
          _setCurrentCompanyState(found); // Don't trigger effect loop, just set state
        }
      } else if (data.length > 0 && !currentCompany) {
        // Optional: Select first company if none selected?
        // Let's stick to explicit selection or restoration for now.
        // But if user has only one company, might be nice.
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Initial load
  useEffect(() => {
    if (authLoading) return;

    if (isAuthenticated) {
      refreshCompanies();
    } else {
      setCompanies([]);
      setCurrentCompany(null);
      setIsLoading(false);
    }
  }, [
    isAuthenticated,
    authLoading,
    refreshCompanies,
    setCurrentCompany,
  ]);

  return (
    <CompanyContext.Provider
      value={{
        currentCompany,
        companies,
        setCurrentCompany,
        setCompanies,
        refreshCompanies,
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
