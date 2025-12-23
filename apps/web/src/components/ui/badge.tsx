import * as React from 'react';

/* eslint-disable @sync-erp/no-hardcoded-enum */
type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning';
/* eslint-enable @sync-erp/no-hardcoded-enum */

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-primary-600 text-white border-transparent',
  secondary: 'bg-gray-100 text-gray-900 border-transparent',
  destructive: 'bg-red-500 text-white border-transparent',
  outline: 'bg-transparent text-gray-700 border-gray-300',
  success: 'bg-green-500 text-white border-transparent',
  warning: 'bg-yellow-500 text-white border-transparent',
};

export function Badge({
  className = '',
  variant = 'default',
  ...props
}: BadgeProps) {
  const baseClasses =
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors';
  const variantClass =
    variantClasses[variant] || variantClasses.default;

  return (
    <span
      className={`${baseClasses} ${variantClass} ${className}`}
      {...props}
    />
  );
}
