import { Outlet, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileMenuButton from './MobileMenuButton';

export default function Layout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div
        className={`
        flex-1 flex flex-col min-h-screen transition-all duration-300
        md:ml-64
      `}
      >
        {/* Simplified Header (Mobile only shows hamburger) */}
        <header className="md:hidden glass sticky top-0 z-30 shadow-sm">
          <div className="flex items-center justify-between h-14 px-4">
            <MobileMenuButton />
            <Link to="/" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">
                  S
                </span>
              </div>
              <span className="text-lg font-semibold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
                Sync ERP
              </span>
            </Link>
            <div className="w-10" /> {/* Spacer for balance */}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-200 mt-auto">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <p className="text-center text-sm text-gray-500">
              © 2024 Sync ERP. Multi-Company Enterprise Resource
              Planning.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
