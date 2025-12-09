import { Routes, Route } from 'react-router-dom';
import { CompanyProvider } from './contexts/CompanyContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
import CreateCompany from './pages/CreateCompany';
import Suppliers from './pages/Suppliers';
import Products from './pages/Products';
import PurchaseOrders from './pages/PurchaseOrders';
import Inventory from './pages/Inventory';
import SalesOrders from './pages/SalesOrders';
import Invoices from './pages/Invoices';

function App() {
  return (
    <CompanyProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="companies" element={<Companies />} />
          <Route path="companies/new" element={<CreateCompany />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="products" element={<Products />} />
          <Route path="purchase-orders" element={<PurchaseOrders />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="sales-orders" element={<SalesOrders />} />
          <Route path="invoices" element={<Invoices />} />
        </Route>
      </Routes>
    </CompanyProvider>
  );
}

export default App;
