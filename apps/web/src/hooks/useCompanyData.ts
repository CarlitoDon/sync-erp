import { useState, useEffect, useCallback, useRef } from 'react';
import { useCompany } from '../contexts/CompanyContext';

interface UseCompanyDataReturn<T> {
  data: T;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T>>;
}

export function useCompanyData<T>(
  fetcher: () => Promise<T>,
  initialData: T
): UseCompanyDataReturn<T> {
  const { currentCompany } = useCompany();
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Use refs to store the latest fetcher and initialData to avoid infinite loops
  // when they are passed as inline functions/objects which change on every render
  const fetcherRef = useRef(fetcher);
  const initialDataRef = useRef(initialData);

  useEffect(() => {
    fetcherRef.current = fetcher;
    initialDataRef.current = initialData;
  }, [fetcher, initialData]);

  const loadData = useCallback(async () => {
    if (!currentCompany) {
      setData(initialDataRef.current);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      // Call the latest fetcher from the ref
      const result = await fetcherRef.current();
      setData(result);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
    // Dependencies are minimized effectively to just currentCompany ID
    // Refs are stable, so they don't need to be in the dependency array
  }, [currentCompany?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { data, loading, error, refresh: loadData, setData };
}
