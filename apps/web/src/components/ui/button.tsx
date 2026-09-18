import * as React from 'react';

// Spinner component for loading state
const Spinner = () => (
  <svg
    className="animate-spin h-4 w-4"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

/* eslint-disable @sync-erp/no-hardcoded-enum */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loadingText?: string;
}
/* eslint-enable @sync-erp/no-hardcoded-enum */

export const Button = React.forwardRef<
  HTMLButtonElement,
  ButtonProps
>(
  (
    {
      className = '',
      variant = 'primary',
      size = 'md',
      isLoading = false,
      loadingText,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

    const variants = {
      primary:
        'bg-blue-600 text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700 focus-visible:ring-blue-500 focus-visible:ring-offset-white',
      secondary:
        'border border-slate-300 bg-white text-slate-800 shadow-2xs hover:bg-slate-50 focus-visible:ring-slate-400 focus-visible:ring-offset-white',
      outline:
        'border border-slate-300 bg-transparent hover:bg-slate-100 text-slate-800 focus-visible:ring-slate-400 focus-visible:ring-offset-white',
      ghost: 'hover:bg-slate-100 text-slate-600 hover:text-slate-900',
      danger:
        'bg-rose-600 text-white shadow-sm shadow-rose-600/20 hover:bg-rose-700 focus-visible:ring-rose-500 focus-visible:ring-offset-white',
    };

    const sizes = {
      sm: 'h-8 min-h-[32px] px-3 text-xs',
      md: 'h-10 min-h-[40px] px-4 py-2 text-sm',
      lg: 'h-12 min-h-[44px] px-6 text-base',
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Spinner />}
        {isLoading && loadingText ? loadingText : children}
      </button>
    );
  }
);
Button.displayName = 'Button';
