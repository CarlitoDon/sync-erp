import { useState, useCallback } from 'react';

/**
 * Hook for managing loading state during form submissions.
 * Prevents double-click by tracking in-flight state.
 *
 * Per FR-019: All submit buttons MUST be disabled during in-flight requests.
 *
 * @example
 * const { isLoading, withLoading } = useLoadingSubmit();
 *
 * const handleSubmit = withLoading(async () => {
 *   await apiCall();
 * });
 *
 * <Button isLoading={isLoading} onClick={handleSubmit}>Submit</Button>
 */
export function useLoadingSubmit() {
  const [isLoading, setIsLoading] = useState(false);

  const withLoading = useCallback(
    <T>(fn: () => Promise<T>) => {
      return async () => {
        if (isLoading) return; // Prevent double-click

        setIsLoading(true);
        try {
          return await fn();
        } finally {
          setIsLoading(false);
        }
      };
    },
    [isLoading]
  );

  return { isLoading, setIsLoading, withLoading };
}
