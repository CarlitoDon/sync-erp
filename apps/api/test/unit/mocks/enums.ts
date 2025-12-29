export enum PartnerType {
  CUSTOMER = 'CUSTOMER',
  SUPPLIER = 'SUPPLIER',
}
export enum OrderType {
  SALES = 'SALES',
  PURCHASE = 'PURCHASE',
}
export enum OrderStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED',
  PARTIALLY_RECEIVED = 'PARTIALLY_RECEIVED',
  RECEIVED = 'RECEIVED',
  PARTIALLY_SHIPPED = 'PARTIALLY_SHIPPED',
  SHIPPED = 'SHIPPED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}
export enum MovementType {
  IN = 'IN',
  OUT = 'OUT',
}
export enum InvoiceType {
  INVOICE = 'INVOICE',
  BILL = 'BILL',
}
export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  PAID = 'PAID',
  VOID = 'VOID',
}
export enum AccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE',
}
export enum BusinessShape {
  PENDING = 'PENDING',
  RETAIL = 'RETAIL',
  MANUFACTURING = 'MANUFACTURING',
  SERVICE = 'SERVICE',
}
export enum CostingMethod {
  AVG = 'AVG',
  FIFO = 'FIFO',
}
export enum SagaType {
  INVOICE_POST = 'INVOICE_POST',
  SHIPMENT = 'SHIPMENT',
  GOODS_RECEIPT = 'GOODS_RECEIPT',
  BILL_POST = 'BILL_POST',
  PAYMENT_POST = 'PAYMENT_POST',
  CREDIT_NOTE = 'CREDIT_NOTE',
  STOCK_TRANSFER = 'STOCK_TRANSFER',
  STOCK_RETURN = 'STOCK_RETURN',
}
export enum SagaStep {
  PENDING = 'PENDING',
  STOCK_DONE = 'STOCK_DONE',
  BALANCE_DONE = 'BALANCE_DONE',
  JOURNAL_DONE = 'JOURNAL_DONE',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  COMPENSATION_FAILED = 'COMPENSATION_FAILED',
}
export enum IdempotencyScope {
  PAYMENT_CREATE = 'PAYMENT_CREATE',
  INVOICE_POST = 'INVOICE_POST',
}
export enum PaymentTerms {
  NET7 = 'NET7',
  NET30 = 'NET30',
  NET60 = 'NET60',
  NET90 = 'NET90',
  COD = 'COD',
  EOM = 'EOM',
  NET_30 = 'NET_30',
  UPFRONT = 'UPFRONT',
}
export enum SequenceType {
  PO = 'PO',
  GRN = 'GRN',
  SHP = 'SHP',
  SO = 'SO',
  INV = 'INV',
  BILL = 'BILL',
  PAY = 'PAY', // Payment Made
  JE = 'JE', // Journal Entry
  CN = 'CN', // Credit Note (AR)
  DN = 'DN', // Debit Note (AP)
}
export enum EntityType {
  INVOICE = 'INVOICE',
  BILL = 'BILL',
  PAYMENT = 'PAYMENT',
  ORDER = 'ORDER',
  PARTNER = 'PARTNER',
  PRODUCT = 'PRODUCT',
  INVENTORY = 'INVENTORY',
  JOURNAL = 'JOURNAL',
  COMPANY = 'COMPANY',
  USER = 'USER',
}
export enum AuditLogAction {
  INVOICE_VOIDED = 'INVOICE_VOIDED',
  BILL_VOIDED = 'BILL_VOIDED',
  PAYMENT_VOIDED = 'PAYMENT_VOIDED',
  ORDER_VOIDED = 'ORDER_VOIDED',
}
