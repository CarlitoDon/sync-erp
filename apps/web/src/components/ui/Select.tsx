import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDownIcon,
  PlusIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

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
  groups?: SelectOptionGroup[];
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
  portal?: boolean;
  /** Enable search/filter functionality */
  searchable?: boolean;
  /** Show "Create new" option. Default true */
  allowCreate?: boolean;
  /** Callback when user wants to create new option */
  onCreate?: (searchTerm: string) => void;
  /** URL to navigate for creating new item (if no onCreate) */
  createHref?: string;
  /** Label for create new button */
  createLabel?: string;
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
  portal = true,
  searchable = true,
  allowCreate = true,
  onCreate,
  createHref,
  createLabel = 'Tambah baru',
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [dropdownStyle, setDropdownStyle] =
    useState<React.CSSProperties>({});

  useLayoutEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownStyle(
        portal
          ? {
              position: 'fixed',
              top: rect.bottom + 4,
              left: rect.left,
              width: rect.width,
              zIndex: 9999,
            }
          : {
              position: 'absolute',
              top: '100%',
              left: 0,
              width: '100%',
              marginTop: '0.25rem',
              zIndex: 9999,
            }
      );
    }
  }, [isOpen, portal]);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

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

  useEffect(() => {
    if (isOpen) {
      const handleScroll = (event: Event) => {
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

  const allOptions: SelectOption[] = groups
    ? groups.flatMap((g) => g.options)
    : options;

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(term)
    );
  }, [options, searchTerm]);

  const filteredGroups = useMemo(() => {
    if (!groups || !searchTerm.trim()) return groups;
    const term = searchTerm.toLowerCase();
    return groups
      .map((group) => ({
        ...group,
        options: group.options.filter((opt) =>
          opt.label.toLowerCase().includes(term)
        ),
      }))
      .filter((group) => group.options.length > 0);
  }, [groups, searchTerm]);

  const selectedOption = allOptions.find(
    (opt) => opt.value === value
  );

  const hasResults = groups
    ? (filteredGroups?.length ?? 0) > 0
    : filteredOptions.length > 0;

  const handleCreate = () => {
    if (onCreate) {
      onCreate(searchTerm);
      setIsOpen(false);
      setSearchTerm('');
    } else if (createHref) {
      window.open(createHref, '_blank');
      setIsOpen(false);
    } else {
      toast('Buat item baru di menu Settings', { icon: 'ℹ️' });
      setIsOpen(false);
    }
  };

  const renderOption = (option: SelectOption) => (
    <div
      key={option.value}
      className={`relative cursor-pointer select-none py-2 pl-3 pr-9 hover:bg-cyan-50 ${
        value === option.value
          ? 'bg-cyan-50 font-medium text-cyan-900'
          : 'text-slate-900'
      }`}
      onClick={() => {
        onChange(String(option.value));
        setIsOpen(false);
      }}
    >
      <span className="block truncate">{option.label}</span>
      {value === option.value && (
        <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-cyan-700">
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
      className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-200/60 focus:outline-none"
    >
      {searchable && (
        <div className="border-b border-slate-100 p-2">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari..."
              className="w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-950 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      <div className="py-1 text-base sm:text-sm max-h-60 overflow-y-auto">
        {!hasResults && !allowCreate ? (
          <div className="relative cursor-default select-none px-4 py-2 text-slate-500">
            {searchTerm ? 'Tidak ditemukan' : 'No options available'}
          </div>
        ) : filteredGroups ? (
          filteredGroups.map((group, groupIndex) => (
            <div key={group.label}>
              {groupIndex > 0 && (
                <div className="my-1 border-t border-slate-200" />
              )}
              <div className="bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {group.label}
              </div>
              {group.options.map(renderOption)}
            </div>
          ))
        ) : (
          filteredOptions.map(renderOption)
        )}

        {allowCreate && (
          <>
            {hasResults && (
              <div className="my-1 border-t border-slate-200" />
            )}
            <div
              className="relative flex cursor-pointer select-none items-center gap-2 py-2 pl-3 pr-9 text-emerald-700 hover:bg-emerald-50"
              onClick={handleCreate}
            >
              <PlusIcon className="h-4 w-4" />
              <span>
                {createLabel}
                {searchTerm && `: "${searchTerm}"`}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="mb-1 block text-sm font-medium text-slate-700">
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
        className={`flex w-full cursor-default items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-left shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 sm:text-sm ${
          disabled
            ? 'cursor-not-allowed bg-slate-100'
            : 'hover:border-slate-400'
        } ${isOpen ? 'border-cyan-500' : ''}`}
      >
        <span
          className={`block flex-1 truncate ${!selectedOption ? 'text-slate-400' : 'text-slate-900'}`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="pointer-events-none flex items-center ml-2">
          <ChevronDownIcon
            className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'transform rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </span>
      </button>

      {isOpen &&
        (portal
          ? createPortal(dropdownContent, document.body)
          : dropdownContent)}
    </div>
  );
}
