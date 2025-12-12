import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SidebarNav from '../../src/components/SidebarNav';
import { SidebarProvider } from '../../src/contexts/SidebarContext';

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
      expect(screen.getByText('Bills')).toBeInTheDocument();
      expect(screen.getByText('Sales Orders')).toBeInTheDocument();
      expect(screen.getByText('Inventory')).toBeInTheDocument();
      expect(screen.getByText('Invoices')).toBeInTheDocument();
      expect(screen.getByText('Finance')).toBeInTheDocument();
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

    it('has correct link for Bills', () => {
      renderComponent();

      expect(
        screen.getByRole('link', { name: /bills/i })
      ).toHaveAttribute('href', '/bills');
    });

    it('has correct link for Sales Orders', () => {
      renderComponent();

      expect(
        screen.getByRole('link', { name: /sales orders/i })
      ).toHaveAttribute('href', '/sales-orders');
    });

    it('has correct link for Inventory', () => {
      renderComponent();

      expect(
        screen.getByRole('link', { name: /inventory/i })
      ).toHaveAttribute('href', '/inventory');
    });

    it('has correct link for Invoices', () => {
      renderComponent();

      expect(
        screen.getByRole('link', { name: /invoices/i })
      ).toHaveAttribute('href', '/invoices');
    });

    it('has correct link for Finance', () => {
      renderComponent();

      expect(
        screen.getByRole('link', { name: /finance/i })
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

    it('highlights Finance when on finance subpath', () => {
      renderComponent('/finance/journal');

      const financeLink = screen.getByRole('link', {
        name: /finance/i,
      });
      expect(financeLink).toHaveClass('bg-primary-100');
    });
  });
});
