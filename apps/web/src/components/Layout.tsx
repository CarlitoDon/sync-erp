import { Outlet, Link } from 'react-router-dom';
import { useCompany } from '../contexts/CompanyContext';
import CompanySwitcher from './CompanySwitcher';

export default function Layout() {
  const { currentCompany } = useCompany();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="glass sticky top-0 z-50 shadow-sm">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">S</span>
                </div>
                <span className="text-xl font-semibold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
                  Sync ERP
                </span>
              </Link>
            </div>

            {/* Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <Link
                to="/"
                className="text-gray-600 hover:text-primary-600 transition-colors font-medium"
              >
                Dashboard
              </Link>
              <Link
                to="/companies"
                className="text-gray-600 hover:text-primary-600 transition-colors font-medium"
              >
                Companies
              </Link>
            </div>

            {/* Right side */}
            <div className="flex items-center space-x-4">
              <CompanySwitcher />
              {currentCompany && (
                <div className="text-sm text-gray-500">
                  <span className="font-medium text-gray-700">{currentCompany.name}</span>
                </div>
              )}
            </div>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-500">
            © 2024 Sync ERP. Multi-Company Enterprise Resource Planning.
          </p>
        </div>
      </footer>
    </div>
  );
}
