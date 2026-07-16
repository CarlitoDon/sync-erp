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
  default: 'border-cyan-200 bg-cyan-50 text-cyan-800',
  secondary: 'border-slate-200 bg-slate-100 text-slate-800',
  destructive: 'border-red-200 bg-red-50 text-red-700',
  outline: 'border-slate-300 bg-white text-slate-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
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
