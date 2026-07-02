import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '@/contexts/CompanyContext';
import type { Company } from '@/types/api';

export default function CompanySwitcher() {
  const navigate = useNavigate();
  const { companies, currentCompany, setCurrentCompany, isLoading } =
    useCompany();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (company: Company) => {
    setCurrentCompany(company);
    setIsOpen(false);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse text-sm text-slate-400">
        Loading...
      </div>
    );
  }

  if (companies.length === 0) {
    return <div className="text-sm text-slate-400">No companies</div>;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 transition-colors hover:border-cyan-300/50 hover:bg-white/[0.1]"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white text-slate-950">
          <span className="text-xs font-bold">
            {currentCompany?.name?.charAt(0) || '?'}
          </span>
        </div>
        <span className="text-sm font-medium text-white">
          {currentCompany?.name || 'Select Company'}
        </span>
        <svg
          className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-xl shadow-slate-950/10">
          {companies.map((company) => (
            <button
              key={company.id}
              onClick={() => handleSelect(company)}
              className={`flex w-full items-center space-x-2 px-4 py-2 text-left text-sm hover:bg-slate-50 ${
                currentCompany?.id === company.id
                  ? 'bg-cyan-50 text-cyan-800'
                  : 'text-slate-700'
              }`}
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-950">
                <span className="text-xs font-bold text-white">
                  {company.name.charAt(0)}
                </span>
              </div>
              <span>{company.name}</span>
              {currentCompany?.id === company.id && (
                <svg
                  className="ml-auto h-4 w-4 text-cyan-700"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}
          <div className="my-1 border-t border-slate-100"></div>
          <button
            onClick={() => {
              setIsOpen(false);
              navigate('/select-company');
            }}
            className="flex w-full items-center space-x-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <div className="flex h-6 w-6 items-center justify-center">
              <span className="text-lg leading-none text-slate-400">
                +
              </span>
            </div>
            <span>Manage Companies...</span>
          </button>
        </div>
      )}
    </div>
  );
}
