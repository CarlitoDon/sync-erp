import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

interface UseApiActionOptions {
  successMessage?: string;
  onSuccess?: () => void;
}

/**
 * Hook for executing API actions with automatic toast notifications.
 * Error toasts are handled globally by the API interceptor.
 * Success toasts are shown only if successMessage is provided.
 *
 * @example
 * const { execute, loading } = useApiAction(
 *   (id: string) => partnerService.delete(id),
 *   { successMessage: 'Deleted!', onSuccess: refresh }
 * );
 *
 * // Then call: execute(partnerId)
 */
export function useApiAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  options: UseApiActionOptions = {}
): { execute: (...args: TArgs) => Promise<void>; loading: boolean } {
  const [loading, setLoading] = useState(false);
  const { successMessage, onSuccess } = options;

  const execute = useCallback(
    async (...args: TArgs) => {
      setLoading(true);
      try {
        await action(...args);
        if (successMessage) {
          toast.success(successMessage);
        }
        onSuccess?.();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred';
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [action, successMessage, onSuccess]
  );

  return { execute, loading };
}

/**
 * Simpler version for one-off actions without the hook pattern.
 *
 * @example
 * await apiAction(() => service.create(data), 'Created!');
 */
export async function apiAction<T>(
  action: () => Promise<T>,
  successMessage?: string
): Promise<T | undefined> {
  try {
    const result = await action();
    if (successMessage) {
      toast.success(successMessage);
    }
    return result;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'An unexpected error occurred';
    toast.error(message);
    return undefined;
  }
}
