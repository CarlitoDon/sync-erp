import * as React from 'react';

/* eslint-disable @sync-erp/no-hardcoded-enum */
export interface DatePickerProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange'
> {
  value: string; // ISO date string (YYYY-MM-DD)
  onChange: (value: string) => void;
  label?: string;
  error?: string;
}
/* eslint-enable @sync-erp/no-hardcoded-enum */

/**
 * Simple DatePicker component using native date input.
 * Per Guardrails G5: businessDate is required for financial operations.
 *
 * @example
 * <DatePicker
 *   label="Business Date"
 *   value={form.businessDate}
 *   onChange={(date) => setForm({ ...form, businessDate: date })}
 * />
 */
export const DatePicker = React.forwardRef<
  HTMLInputElement,
  DatePickerProps
>(
  (
    { value, onChange, label, error, className = '', id, ...props },
    ref
  ) => {
    const inputId = id || `date-picker-${React.useId()}`;

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-gray-700"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`
            h-10 px-3 py-2 text-sm
            border border-gray-300 rounded-lg
            bg-white text-gray-900
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
            disabled:opacity-50 disabled:bg-gray-100
            ${error ? 'border-red-500 focus:ring-red-500' : ''}
            ${className}
          `}
          {...props}
        />
        {error && (
          <span className="text-xs text-red-600">{error}</span>
        )}
      </div>
    );
  }
);
DatePicker.displayName = 'DatePicker';
