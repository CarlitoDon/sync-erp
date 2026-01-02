import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectOptionGroup {
  label: string;
  options: SelectOption[];
}

interface SelectProps {
  label?: string;
  value: string | number;
  onChange: (value: string) => void;
  options?: SelectOption[];
  groups?: SelectOptionGroup[]; // For grouped options
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

export default function Select({
  label,
  value,
  onChange,
  options = [],
  groups,
  placeholder = 'Select an option',
  required = false,
  className = '',
  disabled = false,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] =
    useState<React.CSSProperties>({});

  // Calculate dropdown position when opening
  // useLayoutEffect runs synchronously before browser paint,
  // ensuring position is calculated before the dropdown is visible
  useLayoutEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // Use fixed positioning with viewport-relative coordinates
      // getBoundingClientRect() already returns viewport-relative values
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside (both container AND dropdown portal)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideContainer =
        containerRef.current?.contains(target);
      const isInsideDropdown = dropdownRef.current?.contains(target);

      if (!isInsideContainer && !isInsideDropdown) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close on external scroll (not dropdown internal scroll)
  useEffect(() => {
    if (isOpen) {
      const handleScroll = (event: Event) => {
        // Don't close if scrolling inside the dropdown itself
        if (dropdownRef.current?.contains(event.target as Node)) {
          return;
        }
        setIsOpen(false);
      };
      window.addEventListener('scroll', handleScroll, true);
      return () =>
        window.removeEventListener('scroll', handleScroll, true);
    }
  }, [isOpen]);

  // Get all options (flat or from groups) for finding selected option
  const allOptions: SelectOption[] = groups
    ? groups.flatMap((g) => g.options)
    : options;

  const selectedOption = allOptions.find(
    (opt) => opt.value === value
  );

  // Render a single option item
  const renderOption = (option: SelectOption) => (
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
      <span className="block truncate">{option.label}</span>
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
  );

  const dropdownContent = (
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className="bg-white shadow-lg max-h-60 rounded-lg border border-gray-200 focus:outline-none overflow-hidden"
    >
      <div className="py-1 text-base sm:text-sm max-h-60 overflow-y-auto">
        {allOptions.length === 0 ? (
          <div className="cursor-default select-none relative py-2 px-4 text-gray-500">
            No options available
          </div>
        ) : groups ? (
          // Render grouped options
          groups.map((group, groupIndex) => (
            <div key={group.label}>
              {groupIndex > 0 && (
                <div className="border-t border-gray-200 my-1" />
              )}
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                {group.label}
              </div>
              {group.options.map(renderOption)}
            </div>
          ))
        ) : (
          // Render flat options
          options.map(renderOption)
        )}
      </div>
    </div>
  );

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}{' '}
          {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <button
        ref={buttonRef}
        type="button"
        data-testid="select-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-left cursor-default focus:outline-none focus:border-primary-500 sm:text-sm flex items-center justify-between ${
          disabled
            ? 'bg-gray-100 cursor-not-allowed'
            : 'hover:border-gray-400'
        } ${isOpen ? 'border-primary-500' : ''}`}
      >
        <span
          className={`block truncate flex-1 ${!selectedOption ? 'text-gray-400' : 'text-gray-900'}`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="pointer-events-none flex items-center ml-2">
          <ChevronDownIcon
            className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
              isOpen ? 'transform rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </span>
      </button>

      {/* Render dropdown in portal to escape overflow containers */}
      {isOpen && createPortal(dropdownContent, document.body)}
    </div>
  );
}
