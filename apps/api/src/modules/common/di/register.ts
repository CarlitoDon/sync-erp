/**
 * Service Registration
 *
 * Registers all services and repositories with the DI container.
 * Called once on app startup.
 */

import { container, ServiceKeys } from './container';

// Repositories
import { InventoryRepository } from '../../inventory/inventory.repository';
import { JournalRepository } from '../../accounting/repositories/journal.repository';
import { InvoiceRepository } from '../../accounting/repositories/invoice.repository';
import { PurchaseOrderRepository } from '../../procurement/purchase-order.repository';
import { SalesOrderRepository } from '../../sales/sales-order.repository';
import { PaymentRepository } from '../../accounting/repositories/payment.repository';
import { ProductRepository } from '../../product/product.repository';
import { PartnerRepository } from '../../partner/partner.repository';
import { AccountRepository } from '../../accounting/repositories/account.repository';
import { AuthRepository } from '../../auth/auth.repository';
import { UserRepository } from '../../user/user.repository';
import { CompanyRepository } from '../../company/company.repository';
import { CustomerDepositRepository } from '../../sales/customer-deposit.repository';
import { UpfrontPaymentRepository } from '../../procurement/upfront-payment.repository';
import { CashBankRepository } from '../../cash-bank/cash-bank.repository'; // Feature 042
import { RentalRepository } from '../../rental/rental.repository'; // Feature 043

// Services
import { ProductService } from '../../product/product.service';
import { PartnerService } from '../../partner/partner.service';
import { AccountService } from '../../accounting/services/account.service';
import { DocumentNumberService } from '../services/document-number.service';
import { JournalService } from '../../accounting/services/journal.service';
import { InventoryService } from '../../inventory/inventory.service';
import { BillService } from '../../accounting/services/bill.service';
import { InvoiceService } from '../../accounting/services/invoice.service';
import { PaymentService } from '../../accounting/services/payment.service';
import { PurchaseOrderService } from '../../procurement/purchase-order.service';
import { SalesOrderService } from '../../sales/sales-order.service';
import { IdempotencyService } from '../services/idempotency.service';
import { CompanyService } from '../../company/company.service';
import { AuthService } from '../../auth/auth.service';
import { UserService } from '../../user/user.service';
import { CustomerDepositService } from '../../sales/customer-deposit.service';
import { UpfrontPaymentService } from '../../procurement/upfront-payment.service';
import { DashboardService } from '../../dashboard/service';
import { AdminService } from '../../admin/service';
import { AdminRepository } from '../../admin/repository';
import { ReportService } from '../../accounting/services/report.service';
import { ExpenseService } from '../../accounting/services/expense.service';
import { CashBankService } from '../../cash-bank/cash-bank.service'; // Feature 042
import { RentalService } from '../../rental/rental.service'; // Feature 043

/**
 * Register all services with the DI container
 */
export function registerServices(): void {
  // ==========================================
  // REPOSITORIES
  // ==========================================
  container.register(
    ServiceKeys.INVENTORY_REPOSITORY,
    () => new InventoryRepository()
  );
  container.register(
    ServiceKeys.JOURNAL_REPOSITORY,
    () => new JournalRepository()
  );
  container.register(
    ServiceKeys.INVOICE_REPOSITORY,
    () => new InvoiceRepository()
  );
  container.register(
    ServiceKeys.PURCHASE_ORDER_REPOSITORY,
    () => new PurchaseOrderRepository()
  );
  container.register(
    ServiceKeys.SALES_ORDER_REPOSITORY,
    () => new SalesOrderRepository()
  );
  container.register(
    ServiceKeys.PAYMENT_REPOSITORY,
    () => new PaymentRepository()
  );
  container.register(
    ServiceKeys.PRODUCT_REPOSITORY,
    () => new ProductRepository()
  );
  container.register(
    ServiceKeys.PARTNER_REPOSITORY,
    () => new PartnerRepository()
  );
  container.register(
    ServiceKeys.ACCOUNT_REPOSITORY,
    () => new AccountRepository()
  );
  container.register(
    ServiceKeys.AUTH_REPOSITORY,
    () => new AuthRepository()
  );
  container.register(
    ServiceKeys.USER_REPOSITORY,
    () => new UserRepository()
  );
  container.register(
    ServiceKeys.COMPANY_REPOSITORY,
    () => new CompanyRepository()
  );
  container.register(
    ServiceKeys.CUSTOMER_DEPOSIT_REPOSITORY,
    () => new CustomerDepositRepository()
  );
  container.register(
    ServiceKeys.UPFRONT_PAYMENT_REPOSITORY,
    () => new UpfrontPaymentRepository()
  );
  container.register(
    ServiceKeys.CASH_BANK_REPOSITORY,
    () => new CashBankRepository()
  );
  container.register(
    ServiceKeys.RENTAL_REPOSITORY,
    () => new RentalRepository()
  );

  // ==========================================
  // SERVICES
  // ==========================================

  // Infrastructure Services
  container.register(
    ServiceKeys.DOCUMENT_NUMBER_SERVICE,
    () => new DocumentNumberService()
  );
  container.register(
    ServiceKeys.IDEMPOTENCY_SERVICE,
    () => new IdempotencyService()
  );

  // Core Module Services
  container.register(
    ServiceKeys.ACCOUNT_SERVICE,
    () =>
      new AccountService(
        container.resolve(ServiceKeys.ACCOUNT_REPOSITORY)
      )
  );
  container.register(
    ServiceKeys.PRODUCT_SERVICE,
    () =>
      new ProductService(
        container.resolve(ServiceKeys.PRODUCT_REPOSITORY)
      )
  );
  container.register(
    ServiceKeys.PARTNER_SERVICE,
    () =>
      new PartnerService(
        container.resolve(ServiceKeys.PARTNER_REPOSITORY)
      )
  );
  container.register(
    ServiceKeys.USER_SERVICE,
    () =>
      new UserService(container.resolve(ServiceKeys.USER_REPOSITORY))
  );
  container.register(
    ServiceKeys.COMPANY_SERVICE,
    () =>
      new CompanyService(
        container.resolve(ServiceKeys.COMPANY_REPOSITORY)
      )
  );
  container.register(
    ServiceKeys.AUTH_SERVICE,
    () =>
      new AuthService(
        container.resolve(ServiceKeys.AUTH_REPOSITORY),
        container.resolve(ServiceKeys.USER_SERVICE)
      )
  );

  // Domain Services
  container.register(
    ServiceKeys.JOURNAL_SERVICE,
    () =>
      new JournalService(
        container.resolve(ServiceKeys.JOURNAL_REPOSITORY),
        container.resolve(ServiceKeys.ACCOUNT_SERVICE)
      )
  );
  container.register(
    ServiceKeys.INVENTORY_SERVICE,
    () =>
      new InventoryService(
        container.resolve(ServiceKeys.INVENTORY_REPOSITORY),
        container.resolve(ServiceKeys.PRODUCT_SERVICE),
        container.resolve(ServiceKeys.JOURNAL_SERVICE)
      )
  );

  container.register(
    ServiceKeys.CUSTOMER_DEPOSIT_SERVICE,
    () =>
      new CustomerDepositService(
        container.resolve(ServiceKeys.CUSTOMER_DEPOSIT_REPOSITORY),
        container.resolve(ServiceKeys.JOURNAL_SERVICE)
      )
  );
  container.register(
    ServiceKeys.UPFRONT_PAYMENT_SERVICE,
    () =>
      new UpfrontPaymentService(
        container.resolve(ServiceKeys.UPFRONT_PAYMENT_REPOSITORY),
        container.resolve(ServiceKeys.JOURNAL_SERVICE)
      )
  );

  container.register(
    ServiceKeys.PURCHASE_ORDER_SERVICE,
    () =>
      new PurchaseOrderService(
        container.resolve(ServiceKeys.PURCHASE_ORDER_REPOSITORY),
        container.resolve(ServiceKeys.DOCUMENT_NUMBER_SERVICE),
        container.resolve(ServiceKeys.INVENTORY_SERVICE)
      )
  );
  container.register(
    ServiceKeys.SALES_ORDER_SERVICE,
    () =>
      new SalesOrderService(
        container.resolve(ServiceKeys.SALES_ORDER_REPOSITORY),
        container.resolve(ServiceKeys.PRODUCT_SERVICE),
        container.resolve(ServiceKeys.DOCUMENT_NUMBER_SERVICE),
        container.resolve(ServiceKeys.INVENTORY_SERVICE)
      )
  );

  container.register(
    ServiceKeys.BILL_SERVICE,
    () =>
      new BillService(
        container.resolve(ServiceKeys.INVOICE_REPOSITORY),
        container.resolve(ServiceKeys.INVENTORY_REPOSITORY),
        container.resolve(ServiceKeys.PURCHASE_ORDER_REPOSITORY),
        container.resolve(ServiceKeys.DOCUMENT_NUMBER_SERVICE),
        container.resolve(ServiceKeys.JOURNAL_SERVICE)
      )
  );

  container.register(
    ServiceKeys.INVOICE_SERVICE,
    () =>
      new InvoiceService(
        container.resolve(ServiceKeys.INVOICE_REPOSITORY),
        container.resolve(ServiceKeys.JOURNAL_SERVICE),
        container.resolve(ServiceKeys.DOCUMENT_NUMBER_SERVICE),
        container.resolve(ServiceKeys.IDEMPOTENCY_SERVICE),
        container.resolve(ServiceKeys.INVENTORY_SERVICE),
        container.resolve(ServiceKeys.CUSTOMER_DEPOSIT_SERVICE)
      )
  );

  container.register(
    ServiceKeys.PAYMENT_SERVICE,
    () =>
      new PaymentService(
        container.resolve(ServiceKeys.PAYMENT_REPOSITORY),
        container.resolve(ServiceKeys.INVOICE_REPOSITORY),
        container.resolve(ServiceKeys.IDEMPOTENCY_SERVICE),
        container.resolve(ServiceKeys.JOURNAL_SERVICE)
      )
  );

  // ==========================================
  // ADDITIONAL SERVICES (100% coverage)
  // ==========================================
  container.register(
    ServiceKeys.ADMIN_REPOSITORY,
    () => new AdminRepository()
  );
  container.register(
    ServiceKeys.DASHBOARD_SERVICE,
    () => new DashboardService()
  );
  container.register(
    ServiceKeys.ADMIN_SERVICE,
    () =>
      new AdminService(
        container.resolve(ServiceKeys.ADMIN_REPOSITORY)
      )
  );
  container.register(
    ServiceKeys.REPORT_SERVICE,
    () =>
      new ReportService(
        container.resolve(ServiceKeys.ACCOUNT_REPOSITORY),
        container.resolve(ServiceKeys.JOURNAL_REPOSITORY)
      )
  );
  container.register(
    ServiceKeys.EXPENSE_SERVICE,
    () =>
      new ExpenseService(
        container.resolve(ServiceKeys.INVOICE_REPOSITORY),
        container.resolve(ServiceKeys.DOCUMENT_NUMBER_SERVICE),
        container.resolve(ServiceKeys.JOURNAL_SERVICE)
      )
  );

  container.register(
    ServiceKeys.CASH_BANK_SERVICE,
    () =>
      new CashBankService(
        container.resolve(ServiceKeys.CASH_BANK_REPOSITORY),
        container.resolve(ServiceKeys.ACCOUNT_SERVICE),
        container.resolve(ServiceKeys.JOURNAL_SERVICE)
      )
  );

  container.register(
    ServiceKeys.RENTAL_SERVICE,
    () =>
      new RentalService(
        container.resolve(ServiceKeys.RENTAL_REPOSITORY),
        container.resolve(ServiceKeys.DOCUMENT_NUMBER_SERVICE)
      )
  );
}

// Export for convenience
export { container, ServiceKeys };
