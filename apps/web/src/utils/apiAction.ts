import toast from 'react-hot-toast';
import axios from 'axios';

interface ApiActionOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: unknown) => void;
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
  } catch (error: unknown) {
    let message =
      options.errorMessage || 'An unexpected error occurred';

    if (axios.isAxiosError(error)) {
      message =
        error.response?.data?.error?.message ||
        error.message ||
        message;
    } else if (error instanceof Error) {
      message = error.message;
    }

    toast.error(message);
    options.onError?.(error);
    return undefined;
  }
}
