# Quickstart: Finance Module

## Prerequisites

- Company selected in context
- Chart of Accounts seeded (use Seed button in Finance Overview)

## Running the Feature

1. **Manual Journal Entry**:
   - Go to `/finance` -> "Journals" Tab (New)
   - Click "New Entry"
   - Enter balanced debits/credits
   - See it reflected in Trial Balance

2. **Accounts Payable**:
   - Go to `/finance/accounts-payable`
   - See list of Bills (Purchase Orders that are CONFIRMED create Bills automatically, or create manual Bill)
   - Click "Record Payment" to pay off a bill

3. **Financial Reports**:
   - Go to `/finance` -> "Reports" Tab
   - Select "Income Statement" or "Balance Sheet"
   - Adjust date filters

## Testing Logic

### Auto-Posting Verification

1. Create a Sales Order -> Confirm it
2. Go to Invoices -> Post the Invoice
3. Go to Finance -> Trial Balance
4. Verify "Accounts Receivable" increased and "Sales Revenue" increased

### Balance Check

1. Go to Finance -> Balance Sheet
2. Ensure Assets = Liabilities + Equity is TRUE
