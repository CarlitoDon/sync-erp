import { Link } from 'react-router-dom';
import { useCompany } from '../contexts/CompanyContext';

export default function Companies() {
  const { companies, currentCompany, setCurrentCompany } =
    useCompany();

  const handleSelectCompany = (company: typeof currentCompany) => {
    if (company) {
      setCurrentCompany(company);
      localStorage.setItem('currentCompanyId', company.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Companies
          </h1>
          <p className="text-gray-500 mt-1">
            Manage your companies and switch context
          </p>
        </div>
        <Link
          to="/companies/new"
          className="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg font-medium hover:from-primary-600 hover:to-primary-700 transition-all shadow-md hover:shadow-lg"
        >
          + New Company
        </Link>
      </div>

      {/* Company Grid */}
      {companies.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🏢</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            No companies yet
          </h3>
          <p className="text-gray-500 mb-6">
            Create your first company to get started
          </p>
          <Link
            to="/companies/new"
            className="inline-block px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg font-medium hover:from-primary-600 hover:to-primary-700 transition-all"
          >
            Create Company
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company) => (
            <div
              key={company.id}
              className={`bg-white rounded-xl shadow-sm border p-6 card-hover cursor-pointer ${
                currentCompany?.id === company.id
                  ? 'border-primary-400 ring-2 ring-primary-100'
                  : 'border-gray-100'
              }`}
              onClick={() => handleSelectCompany(company)}
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-accent-500 rounded-xl flex items-center justify-center">
                  <span className="text-white text-xl font-bold">
                    {company.name.charAt(0)}
                  </span>
                </div>
                {currentCompany?.id === company.id && (
                  <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">
                    Active
                  </span>
                )}
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mt-4">
                {company.name}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Created{' '}
                {new Date(company.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
