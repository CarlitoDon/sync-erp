import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SidebarNav from '@/components/layout/SidebarNav';
import { SidebarProvider } from '@/contexts/SidebarContext';

// We need to provide SidebarProvider for SidebarItem which is used inside SidebarNav
const renderComponent = (initialRoute = '/') => {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <SidebarProvider>
        <SidebarNav />
      </SidebarProvider>
    </MemoryRouter>
  );
};

describe('SidebarNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders a nav element', () => {
      renderComponent();

      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('renders all navigation items', () => {
      renderComponent();

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Suppliers')).toBeInTheDocument();
      expect(screen.getByText('Customers')).toBeInTheDocument();
      expect(screen.getByText('Products')).toBeInTheDocument();
      expect(screen.getByText('Purchase Orders')).toBeInTheDocument();
      expect(screen.getByText('Vendor Bills')).toBeInTheDocument();
      expect(screen.getByText('Sales Orders')).toBeInTheDocument();
      expect(screen.getByText('Stock Levels')).toBeInTheDocument();
      expect(
        screen.getByText('Customer Invoices')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Journal & Ledger')
      ).toBeInTheDocument();
      expect(screen.getByText('Companies')).toBeInTheDocument();
    });
  });

  describe('Navigation Links', () => {
    it('has correct link for Dashboard', () => {
      renderComponent();

      expect(
        screen.getByRole('link', { name: /dashboard/i })
      ).toHaveAttribute('href', '/');
    });

    it('has correct link for Suppliers', () => {
      renderComponent();

      expect(
        screen.getByRole('link', { name: /suppliers/i })
      ).toHaveAttribute('href', '/suppliers');
    });

    it('has correct link for Customers', () => {
      renderComponent();

      expect(
        screen.getByRole('link', { name: /customers/i })
      ).toHaveAttribute('href', '/customers');
    });

    it('has correct link for Products', () => {
      renderComponent();

      expect(
        screen.getByRole('link', { name: /products/i })
      ).toHaveAttribute('href', '/products');
    });

    it('has correct link for Purchase Orders', () => {
      renderComponent();

      expect(
        screen.getByRole('link', { name: /purchase orders/i })
      ).toHaveAttribute('href', '/purchase-orders');
    });

    it('has correct link for Vendor Bills', () => {
      renderComponent();

      expect(
        screen.getByRole('link', { name: /vendor bills/i })
      ).toHaveAttribute('href', '/bills');
    });

    it('has correct link for Sales Orders', () => {
      renderComponent();

      expect(
        screen.getByRole('link', { name: /sales orders/i })
      ).toHaveAttribute('href', '/sales-orders');
    });

    it('has correct link for Stock Levels', () => {
      renderComponent();

      expect(
        screen.getByRole('link', { name: /stock levels/i })
      ).toHaveAttribute('href', '/inventory');
    });

    it('has correct link for Customer Invoices', () => {
      renderComponent();

      expect(
        screen.getByRole('link', { name: /customer invoices/i })
      ).toHaveAttribute('href', '/invoices');
    });

    it('has correct link for Journal & Ledger', () => {
      renderComponent();

      expect(
        screen.getByRole('link', { name: /journal & ledger/i })
      ).toHaveAttribute('href', '/finance');
    });

    it('has correct link for Companies', () => {
      renderComponent();

      expect(
        screen.getByRole('link', { name: /companies/i })
      ).toHaveAttribute('href', '/companies');
    });
  });

  describe('Active State', () => {
    it('highlights Dashboard when on root path', () => {
      renderComponent('/');

      const dashboardLink = screen.getByRole('link', {
        name: /dashboard/i,
      });
      expect(dashboardLink).toHaveClass('bg-primary-100');
    });

    it('highlights Products when on products path', () => {
      renderComponent('/products');

      const productsLink = screen.getByRole('link', {
        name: /products/i,
      });
      expect(productsLink).toHaveClass('bg-primary-100');
    });

    it('highlights Journal & Ledger when on finance subpath', () => {
      renderComponent('/finance/journal');

      const financeLink = screen.getByRole('link', {
        name: /journal & ledger/i,
      });
      expect(financeLink).toHaveClass('bg-primary-100');
    });
  });
});
