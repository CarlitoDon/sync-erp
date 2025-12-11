# Data Model: Finance & Accounting

**Source**: Based on `packages/database/prisma/schema.prisma`

## Entities (Existing)

### Account

- `id`: UUID
- `companyId`: UUID
- `code`: String (Unique per company)
- `name`: String
- `type`: AccountType (ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE)
- `isActive`: Boolean

### JournalEntry

- `id`: UUID
- `companyId`: UUID
- `reference`: String?
- `date`: DateTime
- `memo`: String?
- `lines`: JournalLine[]

### JournalLine

- `id`: UUID
- `accountId`: UUID
- `debit`: Decimal
- `credit`: Decimal

## New DTOs (Data Transfer Objects)

These will be defined in `packages/shared/src/types/finance.ts`.

### Journal Entry DTOs

```typescript
// Input for creating a manual journal
export interface CreateJournalEntryInput {
  date: string; // ISO Date
  reference?: string;
  memo?: string;
  lines: CreateJournalLineInput[];
}

export interface CreateJournalLineInput {
  accountId: string;
  debit: number;
  credit: number;
}

// Zod Schema Validation Rules
// - lines.length >= 2
// - sum(lines.debit) === sum(lines.credit)
// - debit >= 0, credit >= 0
// - One of debit/credit must be 0 for each line (typically)
```

### Reporting DTOs

```typescript
export interface BalanceSheetReport {
  assets: AccountGroup[];
  liabilities: AccountGroup[];
  equity: AccountGroup[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  isBalanced: boolean; // Assets = Liabilities + Equity
}

export interface IncomeStatementReport {
  revenue: AccountGroup[];
  expenses: AccountGroup[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
}

export interface AccountGroup {
  type: AccountType;
  accounts: AccountBalance[];
  total: number;
}

export interface AccountBalance {
  id: string;
  code: string;
  name: string;
  balance: number;
}
```

### AR/AP DTOs

```typescript
export interface InvoiceListFilters {
  status?: InvoiceStatus[];
  type: InvoiceType; // INVOICE (AR) or BILL (AP)
  isOverdue?: boolean;
  partnerId?: string;
  startDate?: string;
  endDate?: string;
}

export interface PaymentCreateInput {
  invoiceId: string;
  amount: number;
  method: string;
  date: string;
  reference?: string;
}
```
