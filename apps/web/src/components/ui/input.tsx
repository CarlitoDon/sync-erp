import * as React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Label displayed above the input */
  label?: string;
  /** Error message displayed below the input */
  error?: string;
  /** Helper text displayed below the input (when no error) */
  helperText?: string;
  /** Additional className for the container div */
  containerClassName?: string;
  /**
   * If true, automatically selects all text when the input receives focus.
   * Useful for number inputs to allow easy value replacement.
   */
  selectOnFocus?: boolean;
}

/**
 * Shared Input component with consistent styling.
 * Supports label, error, helperText, and all standard input types.
 * 
 * @example
 * <Input label="Email" type="email" error={errors.email} />
 * <Input label="Amount" type="number" helperText="Enter amount in IDR" />
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className = '',
      containerClassName = '',
      type = 'text',
      label,
      error,
      helperText,
      selectOnFocus,
      onFocus,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      if (selectOnFocus) {
        e.target.select();
      }
      onFocus?.(e);
    };

    return (
      <div className={`w-full ${containerClassName}`}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <input
          type={type}
          className={`flex h-10 w-full rounded-md border ${
            error ? 'border-red-500' : 'border-gray-300'
          } bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-100 ${className}`}
          ref={ref}
          onFocus={handleFocus}
          disabled={disabled}
          required={required}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
        {!error && helperText && (
          <p className="mt-1 text-sm text-gray-500">{helperText}</p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';
