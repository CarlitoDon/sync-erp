export interface EmptyStateProps {
  /** Message to display, defaults to "Not found" */
  message?: string;
  /** Optional icon or illustration */
  icon?: React.ReactNode;
}

/**
 * Reusable component for empty or "not found" states.
 *
 * @example
 * <EmptyState message="Order not found" />
 */
export function EmptyState({
  message = 'Not found',
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      {icon && <div className="text-gray-400">{icon}</div>}
      <div className="text-gray-500">{message}</div>
    </div>
  );
}
