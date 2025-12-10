import { useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import type { Company } from '@sync-erp/shared';

export default function CompanySwitcher() {
  const { companies, currentCompany, setCurrentCompany, isLoading } = useCompany();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (company: Company) => {
    setCurrentCompany(company);
    setIsOpen(false);
  };

  if (isLoading) {
    return <div className="text-sm text-gray-500 animate-pulse">Loading...</div>;
  }

  if (companies.length === 0) {
    return <div className="text-sm text-gray-500">No companies</div>;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-white border border-gray-200 hover:border-primary-400 transition-colors"
      >
        <div className="w-6 h-6 bg-gradient-to-br from-primary-400 to-primary-600 rounded-md flex items-center justify-center">
          <span className="text-white text-xs font-bold">
            {currentCompany?.name?.charAt(0) || '?'}
          </span>
        </div>
        <span className="text-sm font-medium text-gray-700">
          {currentCompany?.name || 'Select Company'}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
          {companies.map((company) => (
            <button
              key={company.id}
              onClick={() => handleSelect(company)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center space-x-2 ${
                currentCompany?.id === company.id
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-700'
              }`}
            >
              <div className="w-6 h-6 bg-gradient-to-br from-gray-400 to-gray-600 rounded-md flex items-center justify-center">
                <span className="text-white text-xs font-bold">{company.name.charAt(0)}</span>
              </div>
              <span>{company.name}</span>
              {currentCompany?.id === company.id && (
                <svg
                  className="w-4 h-4 ml-auto text-primary-600"
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
        </div>
      )}
    </div>
  );
}
