import { Routes, Route } from 'react-router-dom';
import { CompanyProvider } from './contexts/CompanyContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
import CreateCompany from './pages/CreateCompany';

function App() {
  return (
    <CompanyProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="companies" element={<Companies />} />
          <Route path="companies/new" element={<CreateCompany />} />
        </Route>
      </Routes>
    </CompanyProvider>
  );
}

export default App;
