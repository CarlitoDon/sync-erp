import { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectProps {
  label?: string;
  value: string | number;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

export default function Select({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  required = false,
  className = '',
  disabled = false,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}{' '}
          {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <button
        type="button"
        data-testid="select-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-left cursor-default focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm flex items-center justify-between ${
          disabled
            ? 'bg-gray-100 cursor-not-allowed'
            : 'hover:border-gray-400'
        }`}
      >
        <span
          className={`block truncate ${!selectedOption ? 'text-gray-400' : 'text-gray-900'}`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="pointer-events-none flex items-center pr-2">
          <ChevronDownIcon
            className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
              isOpen ? 'transform rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md overflow-hidden ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="py-1 text-base sm:text-sm max-h-60 overflow-auto">
            {options.length === 0 ? (
              <div className="cursor-default select-none relative py-2 px-4 text-gray-500">
                No options available
              </div>
            ) : (
              options.map((option) => (
                <div
                  key={option.value}
                  className={`cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-primary-50 ${
                    value === option.value
                      ? 'text-primary-900 bg-primary-50 font-medium'
                      : 'text-gray-900'
                  }`}
                  onClick={() => {
                    onChange(String(option.value));
                    setIsOpen(false);
                  }}
                >
                  <span className="block truncate">
                    {option.label}
                  </span>
                  {value === option.value && (
                    <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-primary-600">
                      <svg
                        className="h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
