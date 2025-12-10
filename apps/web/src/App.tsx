import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { CompanyProvider } from './contexts/CompanyContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { ConfirmProvider } from './components/ConfirmModal';
import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
import CreateCompany from './pages/CreateCompany';
import Suppliers from './pages/Suppliers';
import Customers from './pages/Customers';
import Products from './pages/Products';
import PurchaseOrders from './pages/PurchaseOrders';
import Inventory from './pages/Inventory';
import SalesOrders from './pages/SalesOrders';
import Invoices from './pages/Invoices';
import Finance from './pages/Finance';
import { RegisterPage } from './pages/RegisterPage';
import { LoginPage } from './pages/LoginPage';
import { CompanySelectionPage } from './pages/CompanySelectionPage';

function App() {
  return (
    <>
      <ConfirmProvider>
        <CompanyProvider>
          <SidebarProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              <Route element={<ProtectedRoute requireCompany={false} />}>
                <Route path="/select-company" element={<CompanySelectionPage />} />
              </Route>

              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<Layout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="companies" element={<Companies />} />
                  <Route path="companies/new" element={<CreateCompany />} />
                  <Route path="suppliers" element={<Suppliers />} />
                  <Route path="customers" element={<Customers />} />
                  <Route path="products" element={<Products />} />
                  <Route path="purchase-orders" element={<PurchaseOrders />} />
                  <Route path="inventory" element={<Inventory />} />
                  <Route path="sales-orders" element={<SalesOrders />} />
                  <Route path="invoices" element={<Invoices />} />
                  <Route path="finance" element={<Finance />} />
                </Route>
              </Route>
            </Routes>
          </SidebarProvider>
        </CompanyProvider>
      </ConfirmProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            style: {
              background: '#10b981',
            },
          },
          error: {
            style: {
              background: '#ef4444',
            },
          },
        }}
      />
    </>
  );
}

export default App;
