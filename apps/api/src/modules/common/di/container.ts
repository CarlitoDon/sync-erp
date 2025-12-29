/**
 * Lightweight Dependency Injection Container
 *
 * Factory-based DI container for managing service instances.
 * - Lazy instantiation: services created on first resolve
 * - Singleton by default: same instance returned on subsequent resolves
 * - Reset capability: for testing purposes
 */

type Factory<T> = () => T;

interface Registration<T> {
  factory: Factory<T>;
  instance?: T;
}

class Container {
  private registrations = new Map<string, Registration<unknown>>();

  /**
   * Register a service factory
   * @param key Unique service identifier
   * @param factory Function that creates the service instance
   */
  register<T>(key: string, factory: Factory<T>): void {
    this.registrations.set(key, { factory });
  }

  /**
   * Resolve a service instance (lazy singleton)
   * @param key Service identifier
   * @returns Service instance
   * @throws Error if service not registered
   */
  resolve<T>(key: string): T {
    const registration = this.registrations.get(key);
    if (!registration) {
      throw new Error(`DI: No registration found for "${key}"`);
    }

    // Lazy instantiation - create on first access
    if (!registration.instance) {
      registration.instance = registration.factory();
    }

    return registration.instance as T;
  }

  /**
   * Check if a service is registered
   */
  has(key: string): boolean {
    return this.registrations.has(key);
  }

  /**
   * Reset all instances (for testing)
   * Keeps registrations but clears instances
   */
  reset(): void {
    for (const registration of this.registrations.values()) {
      registration.instance = undefined;
    }
  }

  /**
   * Clear all registrations and instances
   */
  clear(): void {
    this.registrations.clear();
  }
}

// Global container instance
export const container = new Container();

// Service keys for type-safe resolution
export const ServiceKeys = {
  // Repositories
  INVENTORY_REPOSITORY: 'inventoryRepository',
  JOURNAL_REPOSITORY: 'journalRepository',
  INVOICE_REPOSITORY: 'invoiceRepository',
  PURCHASE_ORDER_REPOSITORY: 'purchaseOrderRepository',
  SALES_ORDER_REPOSITORY: 'salesOrderRepository',
  PRODUCT_REPOSITORY: 'productRepository',
  PARTNER_REPOSITORY: 'partnerRepository',
  ACCOUNT_REPOSITORY: 'accountRepository',

  // Services
  INVENTORY_SERVICE: 'inventoryService',
  PRODUCT_SERVICE: 'productService',
  JOURNAL_SERVICE: 'journalService',
  BILL_SERVICE: 'billService',
  INVOICE_SERVICE: 'invoiceService',
  PAYMENT_SERVICE: 'paymentService',
  PURCHASE_ORDER_SERVICE: 'purchaseOrderService',
  SALES_ORDER_SERVICE: 'salesOrderService',
  PARTNER_SERVICE: 'partnerService',
  ACCOUNT_SERVICE: 'accountService',
  DOCUMENT_NUMBER_SERVICE: 'documentNumberService',
  IDEMPOTENCY_SERVICE: 'idempotencyService',
  CUSTOMER_DEPOSIT_SERVICE: 'customerDepositService',
  UPFRONT_PAYMENT_SERVICE: 'upfrontPaymentService',
  COMPANY_SERVICE: 'companyService',
  AUTH_SERVICE: 'authService',
  USER_SERVICE: 'userService',
  AUTH_REPOSITORY: 'authRepository',
  USER_REPOSITORY: 'userRepository',
  COMPANY_REPOSITORY: 'companyRepository',
  PAYMENT_REPOSITORY: 'paymentRepository',
  CUSTOMER_DEPOSIT_REPOSITORY: 'customerDepositRepository',
  UPFRONT_PAYMENT_REPOSITORY: 'upfrontPaymentRepository',

  // Additional Services
  DASHBOARD_SERVICE: 'dashboardService',
  ADMIN_SERVICE: 'adminService',
  REPORT_SERVICE: 'reportService',
  EXPENSE_SERVICE: 'expenseService',
  ADMIN_REPOSITORY: 'adminRepository',
} as const;

export type ServiceKey =
  (typeof ServiceKeys)[keyof typeof ServiceKeys];
