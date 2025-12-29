import * as React from 'react';

interface CurrencyInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
> {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  error?: string;
  prefix?: string;
  min?: number;
  max?: number;
}

/**
 * Formats a number with thousand separators (Indonesian format: 1.000.000)
 */
const formatNumber = (value: number): string => {
  if (value === 0) return '';
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
  }).format(value);
};

/**
 * Parse a formatted string to number (removes all non-digit characters)
 */
const parseNumber = (value: string): number => {
  const numericString = value.replace(/[^0-9]/g, '');
  if (numericString === '') return 0;
  return parseInt(numericString, 10);
};

/**
 * A controlled currency input with automatic thousand separator formatting.
 * Displays "Rp" prefix by default and formats numbers as you type.
 * Example: typing "1000000" shows "Rp 1.000.000"
 */
export const CurrencyInput = React.forwardRef<
  HTMLInputElement,
  CurrencyInputProps
>(
  (
    {
      className = '',
      label,
      error,
      value,
      onChange,
      prefix = 'Rp',
      min = 0,
      max,
      placeholder = '0',
      ...props
    },
    ref
  ) => {
    // Track the display value as a formatted string
    const [displayValue, setDisplayValue] = React.useState<string>(
      value ? formatNumber(value) : ''
    );

    // Sync external value changes
    React.useEffect(() => {
      setDisplayValue(value ? formatNumber(value) : '');
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;

      // Allow empty input
      if (inputValue === '') {
        setDisplayValue('');
        onChange(0);
        return;
      }

      // Parse and reformat the number
      const numericValue = parseNumber(inputValue);

      // Apply max constraint during typing
      let constrainedValue = numericValue;
      if (max !== undefined && numericValue > max) {
        constrainedValue = max;
      }

      const formatted = formatNumber(constrainedValue);
      setDisplayValue(formatted);
      onChange(constrainedValue);
    };

    const handleBlur = () => {
      const numericValue = parseNumber(displayValue);

      // Apply min constraint on blur
      if (numericValue < min) {
        setDisplayValue(formatNumber(min));
        onChange(min);
        return;
      }

      // Apply max constraint on blur
      if (max !== undefined && numericValue > max) {
        setDisplayValue(formatNumber(max));
        onChange(max);
        return;
      }

      // Reformat to ensure consistent display
      setDisplayValue(numericValue ? formatNumber(numericValue) : '');
    };

    // Select all text on focus for easy replacement
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      e.target.select();
    };

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          {prefix && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 select-none pointer-events-none">
              {prefix}
            </span>
          )}
          <input
            type="text"
            inputMode="numeric"
            className={`flex h-10 w-full rounded-md border ${
              error ? 'border-red-500' : 'border-gray-300'
            } bg-white ${prefix ? 'pl-9' : 'px-3'} pr-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
            ref={ref}
            value={displayValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onFocus={handleFocus}
            placeholder={placeholder}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  }
);
CurrencyInput.displayName = 'CurrencyInput';
