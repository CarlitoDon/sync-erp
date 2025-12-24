/* eslint-disable @sync-erp/no-hardcoded-enum */
type SpinnerSize = 'sm' | 'md' | 'lg';
/* eslint-enable @sync-erp/no-hardcoded-enum */

export interface LoadingSpinnerProps {
  size?: SpinnerSize;
  className?: string;
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

/**
 * Reusable loading spinner component with configurable size.
 *
 * @example
 * <LoadingSpinner size="md" />
 */
export function LoadingSpinner({
  size = 'md',
  className = '',
}: LoadingSpinnerProps) {
  const sizeClass = sizeClasses[size] || sizeClasses.md;

  return (
    <div
      className={`animate-spin rounded-full border-b-2 border-primary-600 ${sizeClass} ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

/**
 * Full container loading state with centered spinner.
 */
export function LoadingState({
  size = 'lg',
  className = '',
}: LoadingSpinnerProps) {
  return (
    <div
      className={`flex items-center justify-center p-8 ${className}`}
    >
      <LoadingSpinner size={size} />
    </div>
  );
}
