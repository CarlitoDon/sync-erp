import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '@/contexts/CompanyContext';
import type { Company } from '@/types/api';
import {
  BuildingOffice2Icon,
  CheckIcon,
  ChevronUpDownIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';

export default function CompanySwitcher() {
  const navigate = useNavigate();
  const { companies, currentCompany, setCurrentCompany, isLoading } =
    useCompany();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (company: Company) => {
    setCurrentCompany(company);
    setIsOpen(false);
  };

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Loading companies"
        className="flex animate-pulse items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-2.5"
      >
        <span className="sr-only">Loading companies</span>
        <div className="h-8 w-8 rounded-lg bg-white/10" />
        <div className="h-3 w-28 rounded bg-white/10" />
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-2.5 text-sm text-slate-400">
        No companies
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="flex w-full items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.06] px-3 py-2.5 text-left transition duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:border-primary-300/40 hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 active:scale-[0.99]"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-950 shadow-sm">
          <span className="text-xs font-bold">
            {currentCompany?.name?.charAt(0) || '?'}
          </span>
        </div>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Company
          </span>
          <span className="block truncate text-sm font-medium text-white">
            {currentCompany?.name || 'Select Company'}
          </span>
        </span>
        <ChevronUpDownIcon className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Select company"
          className="absolute bottom-full left-0 z-50 mb-2 w-full min-w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl shadow-slate-950/20"
        >
          {companies.map((company) => (
            <button
              type="button"
              key={company.id}
              onClick={() => handleSelect(company)}
              role="option"
              aria-selected={currentCompany?.id === company.id}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                currentCompany?.id === company.id
                  ? 'bg-primary-50 font-medium text-primary-900'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-950">
                <span className="text-xs font-bold text-white">
                  {company.name.charAt(0)}
                </span>
              </div>
              <span className="min-w-0 flex-1 truncate">
                {company.name}
              </span>
              {currentCompany?.id === company.id && (
                <CheckIcon className="ml-auto h-4 w-4 shrink-0 text-primary-700" />
              )}
            </button>
          ))}
          <div className="my-1 border-t border-slate-100" />
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              navigate('/select-company');
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
              <BuildingOffice2Icon className="h-4 w-4" />
            </div>
            <span className="flex-1">Manage Companies</span>
            <PlusIcon className="h-4 w-4 text-slate-400" />
          </button>
        </div>
      )}
    </div>
  );
}
