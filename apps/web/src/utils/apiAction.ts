import toast from 'react-hot-toast';

interface ApiActionOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: any) => void;
  successMessage?: string;
  errorMessage?: string;
}

export async function apiAction<T>(
  action: () => Promise<T>,
  options: ApiActionOptions<T> = {}
): Promise<T | undefined> {
  try {
    const result = await action();
    if (options.successMessage) {
      toast.success(options.successMessage);
    }
    options.onSuccess?.(result);
    return result;
  } catch (error: any) {
    const message =
      options.errorMessage ||
      error.response?.data?.error?.message ||
      error.message ||
      'An unexpected error occurred';
    toast.error(message);
    options.onError?.(error);
    return undefined;
  }
}
