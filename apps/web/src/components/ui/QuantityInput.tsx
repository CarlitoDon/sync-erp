import * as React from 'react';

interface QuantityInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
> {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  error?: string;
  allowEmpty?: boolean;
}

/**
 * A controlled quantity input that allows the user to clear the field
 * before typing a new value. The default value is restored on blur if empty.
 */
export const QuantityInput = React.forwardRef<
  HTMLInputElement,
  QuantityInputProps
>(
  (
    {
      className = '',
      label,
      error,
      value,
      onChange,
      min = 1,
      max,
      allowEmpty = false,
      ...props
    },
    ref
  ) => {
    // Internal string state to allow empty input while typing
    const [displayValue, setDisplayValue] = React.useState<string>(
      String(value)
    );

    // Sync external value changes to display
    React.useEffect(() => {
      setDisplayValue(String(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;

      // Allow empty input for better UX
      if (inputValue === '') {
        setDisplayValue('');
        if (allowEmpty) {
          onChange(0);
        }
        return;
      }

      // Only allow numeric input
      const numericValue = inputValue.replace(/[^0-9]/g, '');
      if (numericValue === '') {
        setDisplayValue('');
        return;
      }

      const parsed = parseInt(numericValue, 10);

      // Apply max constraint during typing
      let constrainedValue = parsed;
      if (max !== undefined && parsed > max) {
        constrainedValue = max;
      }

      setDisplayValue(String(constrainedValue));
      onChange(constrainedValue);
    };

    const handleBlur = () => {
      // On blur, if empty restore to min value
      if (displayValue === '' || displayValue === '0') {
        const restoreValue = min;
        setDisplayValue(String(restoreValue));
        onChange(restoreValue);
        return;
      }

      // Apply min/max constraints on blur
      const parsed = parseInt(displayValue, 10);
      let constrainedValue = parsed;

      if (parsed < min) {
        constrainedValue = min;
      } else if (max !== undefined && parsed > max) {
        constrainedValue = max;
      }

      if (constrainedValue !== parsed) {
        setDisplayValue(String(constrainedValue));
        onChange(constrainedValue);
      }
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
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className={`flex h-10 w-full rounded-md border ${
            error ? 'border-red-500' : 'border-gray-300'
          } bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
          ref={ref}
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  }
);
QuantityInput.displayName = 'QuantityInput';
