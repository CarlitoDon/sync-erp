/**
 * Service Registration
 *
 * Registers all services and repositories with the DI container.
 * Called once on app startup from the composition root.
 */

import { container, ServiceKeys } from '../modules/common/di';

// Repositories
import { InventoryRepository } from '../modules/inventory/inventory.repository';
import { JournalRepository } from '../modules/accounting/repositories/journal.repository';
import { InvoiceRepository } from '../modules/accounting/repositories/invoice.repository';
import { PurchaseOrderRepository } from '../modules/procurement/purchase-order.repository';
import { SalesOrderRepository } from '../modules/sales/sales-order.repository';
import { PaymentRepository } from '../modules/accounting/repositories/payment.repository';
import { ProductRepository } from '../modules/product/product.repository';
import { PartnerRepository } from '../modules/partner/partner.repository';
import { AccountRepository } from '../modules/accounting/repositories/account.repository';
import { AuthRepository } from '../modules/auth/auth.repository';
import { UserRepository } from '../modules/user/user.repository';
import { CompanyRepository } from '../modules/company/company.repository';
import { CustomerDepositRepository } from '../modules/sales/customer-deposit.repository';
import { UpfrontPaymentRepository } from '../modules/procurement/upfront-payment.repository';
import { CashBankRepository } from '../modules/cash-bank/cash-bank.repository'; // Feature 042
import { RentalRepository } from '../modules/rental/rental.repository'; // Feature 043

// Services
import { ProductService } from '../modules/product/product.service';
import { PartnerService } from '../modules/partner/partner.service';
import { AccountService } from '../modules/accounting/services/account.service';
import { DocumentNumberService } from '../modules/common/services/document-number.service';
import { JournalService } from '../modules/accounting/services/journal.service';
import { InventoryService } from '../modules/inventory/inventory.service';
import { BillService } from '../modules/accounting/services/bill.service';
import { InvoiceService } from '../modules/accounting/services/invoice.service';
import { PaymentService } from '../modules/accounting/services/payment.service';
import { PurchaseOrderService } from '../modules/procurement/purchase-order.service';
import { SalesOrderService } from '../modules/sales/sales-order.service';
import { IdempotencyService } from '../modules/common/services/idempotency.service';
import { EmailService } from '../modules/common/services/email.service';
import { AuthAuditService } from '../modules/auth/auth-audit.service';
import { GoogleOAuthService } from '../modules/auth/google-oauth.service';
import { CompanyService } from '../modules/company/company.service';
import { AuthService } from '../modules/auth/auth.service';
import { UserService } from '../modules/user/user.service';
import { CustomerDepositService } from '../modules/sales/customer-deposit.service';
import { UpfrontPaymentService } from '../modules/procurement/upfront-payment.service';
import { DashboardService } from '../modules/dashboard/service';
import { AdminService } from '../modules/admin/service';
import { AdminRepository } from '../modules/admin/repository';
import { ReportService } from '../modules/accounting/services/report.service';
import { ExpenseService } from '../modules/accounting/services/expense.service';
import { CashBankService } from '../modules/cash-bank/cash-bank.service'; // Feature 042
import { RentalService } from '../modules/rental/rental.service'; // Feature 043
import { RentalWebhookService } from '../modules/rental/rental-webhook.service'; // Feature 043 - Notifications

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
  container.register(
    ServiceKeys.EMAIL_SERVICE,
    () => new EmailService()
  );
  container.register(
    ServiceKeys.GOOGLE_OAUTH_SERVICE,
    () => new GoogleOAuthService()
  );
  container.register(
    ServiceKeys.AUTH_AUDIT_SERVICE,
    () => new AuthAuditService()
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
        container.resolve(ServiceKeys.COMPANY_REPOSITORY),
        container.resolve(ServiceKeys.ACCOUNT_SERVICE)
      )
  );
  container.register(
    ServiceKeys.AUTH_SERVICE,
    () =>
      new AuthService(
        container.resolve(ServiceKeys.AUTH_REPOSITORY),
        container.resolve(ServiceKeys.USER_SERVICE),
        container.resolve(ServiceKeys.EMAIL_SERVICE),
        container.resolve(ServiceKeys.AUTH_AUDIT_SERVICE)
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
        container.resolve(ServiceKeys.JOURNAL_SERVICE),
        {
          recalculateOrderStatus: (orderId, companyId, tx) =>
            container
              .resolve<SalesOrderService>(ServiceKeys.SALES_ORDER_SERVICE)
              .recalculateOrderStatus(orderId, companyId, tx),
        },
        {
          recalculateOrderStatus: (orderId, companyId, tx) =>
            container
              .resolve<PurchaseOrderService>(ServiceKeys.PURCHASE_ORDER_SERVICE)
              .recalculateOrderStatus(orderId, companyId, tx),
        }
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
        container.resolve(ServiceKeys.INVENTORY_SERVICE),
        container.resolve(ServiceKeys.INVOICE_SERVICE)
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

  // Register webhook service before rental service (it's a dependency)
  container.register(
    ServiceKeys.RENTAL_WEBHOOK_SERVICE,
    () => new RentalWebhookService()
  );

  container.register(
    ServiceKeys.RENTAL_SERVICE,
    () =>
      new RentalService(
        container.resolve(ServiceKeys.RENTAL_WEBHOOK_SERVICE)
      )
  );
}

// Export for convenience
export { container, ServiceKeys };
