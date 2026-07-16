import { ReactNode, useState } from 'react';

/* eslint-disable @sync-erp/no-hardcoded-enum */
type ActionButtonVariant =
  | 'primary'
  | 'success'
  | 'danger'
  | 'warning'
  | 'secondary'
  | 'destructive'
  | 'outline';
/* eslint-enable @sync-erp/no-hardcoded-enum */

interface ActionButtonProps {
  onClick: () => void | Promise<void>;
  variant?: ActionButtonVariant;
  children: ReactNode;
  disabled?: boolean;
  title?: string;
  isLoading?: boolean;
  className?: string;
}

const variantStyles: Record<ActionButtonVariant, string> = {
  primary:
    'border-cyan-200 bg-cyan-50 text-cyan-800 hover:border-cyan-300 hover:bg-cyan-100',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100',
  danger:
    'border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100',
  warning:
    'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100',
  secondary:
    'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50',
  destructive:
    'border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100',
  outline:
    'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50',
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
  const [isInternalLoading, setIsInternalLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click in tables
    if (isLoading || isInternalLoading || disabled) return;

    try {
      setIsInternalLoading(true);
      await onClick();
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      // Small delay to prevent flicker if action is too fast, and to show completion
      // But mainly to clean up
      setIsInternalLoading(false);
    }
  };

  const showLoading = isLoading || isInternalLoading;

  return (
    <button
      onClick={handleClick}
      disabled={disabled || showLoading}
      title={title}
      className={`
        inline-flex items-center justify-center whitespace-nowrap rounded-md border px-3 py-1.5 text-sm font-medium transition-colors
        ${variantStyles[variant]}
        ${disabled || showLoading ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      {showLoading ? 'Processing...' : children}
    </button>
  );
}
