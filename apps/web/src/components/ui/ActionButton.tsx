import { ReactNode } from 'react';

/* eslint-disable @sync-erp/no-hardcoded-enum */
type ActionButtonVariant =
  | 'primary'
  | 'success'
  | 'danger'
  | 'warning'
  | 'secondary';
/* eslint-enable @sync-erp/no-hardcoded-enum */

interface ActionButtonProps {
  onClick: () => void;
  variant?: ActionButtonVariant;
  children: ReactNode;
  disabled?: boolean;
  title?: string;
  isLoading?: boolean;
  className?: string;
}

const variantStyles: Record<ActionButtonVariant, string> = {
  primary:
    'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-400',
  success:
    'border-green-300 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-400',
  danger:
    'border-red-300 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-400',
  warning:
    'border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 hover:border-yellow-400',
  secondary:
    'border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 hover:border-gray-400',
};

export default function ActionButton({
  onClick,
  variant = 'secondary',
  children,
  disabled = false,
  title,
  isLoading = false,
  className = '',
}: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      title={title}
      className={`
        inline-flex items-center justify-center whitespace-nowrap px-3 py-1.5 text-sm font-medium rounded-md border transition-colors
        ${variantStyles[variant]}
        ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      {isLoading ? 'Loading...' : children}
    </button>
  );
}
