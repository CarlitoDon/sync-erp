/**
 * Tool Registry — Aggregates all domain tools.
 */
import type { ToolSpec } from '../types.js';

import { getCompanyTools } from './company.js';
import { getPartnerTools } from './partner.js';
import { getProductTools } from './product.js';
import { getSalesOrderTools } from './sales-order.js';
import { getPurchaseOrderTools } from './purchase-order.js';
import { getBillTools } from './bill.js';
import { getInvoiceTools } from './invoice.js';
import { getPaymentTools } from './payment.js';
import { getInventoryTools } from './inventory.js';
import { getFinanceTools } from './finance.js';
import { getExpenseTools } from './expense.js';
import { getDashboardTools } from './dashboard.js';
import { getUserTools } from './user.js';
import { getUpfrontPaymentTools } from './upfront-payment.js';
import { getCustomerDepositTools } from './customer-deposit.js';
import { getRentalTools } from './rental.js';
import { getRentalBundleTools } from './rental-bundle.js';
import { getCashBankTools } from './cash-bank.js';
import { getPaymentMethodTools } from './payment-method.js';
import { getAttachmentTools } from './attachment.js';

/**
 * Returns all registered MCP tools.
 * Each tool is self-contained with name, description, schema, and handler.
 */
export function getAllTools(): ToolSpec[] {
  return [
    ...getCompanyTools(),
    ...getPartnerTools(),
    ...getProductTools(),
    ...getSalesOrderTools(),
    ...getPurchaseOrderTools(),
    ...getBillTools(),
    ...getInvoiceTools(),
    ...getPaymentTools(),
    ...getInventoryTools(),
    ...getFinanceTools(),
    ...getExpenseTools(),
    ...getDashboardTools(),
    ...getUserTools(),
    ...getUpfrontPaymentTools(),
    ...getCustomerDepositTools(),
    ...getRentalTools(),
    ...getRentalBundleTools(),
    ...getCashBankTools(),
    ...getPaymentMethodTools(),
    ...getAttachmentTools(),
  ];
}
