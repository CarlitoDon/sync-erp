import { renderHook, act } from '@testing-library/react';
import {
  useApiAction,
  apiAction,
} from '../../src/hooks/useApiAction';
import toast from 'react-hot-toast';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useApiAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute action successfully', async () => {
    const action = vi.fn().mockResolvedValue('success');
    const onSuccess = vi.fn();

    const { result } = renderHook(() =>
      useApiAction(action, {
        successMessage: 'Success!',
        onSuccess,
      })
    );

    expect(result.current.loading).toBe(false);

    await act(async () => {
      await result.current.execute('arg1');
    });

    expect(action).toHaveBeenCalledWith('arg1');
    expect(toast.success).toHaveBeenCalledWith('Success!');
    expect(onSuccess).toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it('should handle errors gracefully (relying on interceptor)', async () => {
    const action = vi.fn().mockRejectedValue(new Error('Fail'));
    const onSuccess = vi.fn();

    const { result } = renderHook(() =>
      useApiAction(action, { onSuccess })
    );

    await act(async () => {
      await result.current.execute();
    });

    expect(action).toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it('should set loading state correctly', async () => {
    let resolveAction: (value: unknown) => void;
    const action = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        })
    );

    const { result } = renderHook(() => useApiAction(action));

    let promise: Promise<void>;
    act(() => {
      promise = result.current.execute();
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveAction!(null);
      await promise!;
    });

    expect(result.current.loading).toBe(false);
  });
});

describe('apiAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute action and return result', async () => {
    const action = vi.fn().mockResolvedValue('data');
    const result = await apiAction(action, 'Done');

    expect(result).toBe('data');
    expect(toast.success).toHaveBeenCalledWith('Done');
  });

  it('should return undefined on error', async () => {
    const action = vi.fn().mockRejectedValue(new Error('Fail'));
    const result = await apiAction(action);

    expect(result).toBeUndefined();
  });
});
