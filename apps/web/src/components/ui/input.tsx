import * as React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /**
   * If true, automatically selects all text when the input receives focus.
   * Useful for number inputs to allow easy value replacement.
   */
  selectOnFocus?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className = '',
      type,
      label,
      error,
      selectOnFocus,
      onFocus,
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
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <input
          type={type}
          className={`flex h-10 w-full rounded-md border ${
            error ? 'border-red-500' : 'border-gray-300'
          } bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
          ref={ref}
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
Input.displayName = 'Input';
