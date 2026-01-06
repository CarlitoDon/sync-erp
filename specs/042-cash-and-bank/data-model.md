# Data Model: Cash and Bank

**Feature**: `042-cash-and-bank`
**Based on**: `specs/042-cash-and-bank/research.md`

## 1. Schema Changes (`schema.prisma`)

### New Enums

```prisma
enum CashTransactionType {
  SPEND
  RECEIVE
  TRANSFER
}

enum CashTransactionStatus {
  DRAFT
  POSTED
  VOIDED
}
```

### New Models

#### BankAccount

Represents a liquid asset account (Cash or Bank) that can be used for payments/receipts.

```prisma
model BankAccount {
  id            String   @id @default(uuid())
  companyId     String
  accountId     String   // Link to GL Account
  bankName      String   // e.g. "BCA", "Petty Cash"
  accountNumber String?
  currency      String   @default("IDR")
  isArchived    Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  company   Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  account   Account @relation(fields: [accountId], references: [id])

  // Relations
  outgoingTransactions CashTransaction[] @relation("SourceBank")
  incomingTransactions CashTransaction[] @relation("DestinationBank")

  @@unique([companyId, accountId])
  @@index([companyId])
}
```

#### CashTransaction

Represents a monetary movement involving at least one BankAccount.

```prisma
model CashTransaction {
  id                String                @id @default(uuid())
  companyId         String
  type              CashTransactionType
  status            CashTransactionStatus @default(DRAFT)
  date              DateTime              @default(now())
  reference         String?               // e.g. "INV-001", "Check #123"
  payee             String?               // Name of person/company paid/received from
  description       String?
  amount            Decimal               @db.Decimal(15, 2)

  // Links
  sourceBankAccountId      String?        // For SPEND and TRANSFER
  destinationBankAccountId String?        // For RECEIVE and TRANSFER

  journalEntryId    String?               @unique

  createdAt         DateTime              @default(now())
  updatedAt         DateTime              @updatedAt

  company           Company       @relation(fields: [companyId], references: [id], onDelete: Cascade)
  sourceBank        BankAccount?  @relation("SourceBank", fields: [sourceBankAccountId], references: [id])
  destinationBank   BankAccount?  @relation("DestinationBank", fields: [destinationBankAccountId], references: [id])
  journalEntry      JournalEntry? @relation(fields: [journalEntryId], references: [id])

  items             CashTransactionItem[] // Split lines for Spend/Receive

  @@index([companyId])
  @@index([companyId, type])
  @@index([date])
}
```

#### CashTransactionItem

Represents the "other side" of the transaction (Allocation).

- For SPEND: Represents the Expense/Liability accounts debited.
- For RECEIVE: Represents the Revenue/Equity accounts credited.
- For TRANSFER: Not used (Transfers are 1:1 between banks).

```prisma
model CashTransactionItem {
  id                String  @id @default(uuid())
  cashTransactionId String
  accountId         String  // The allocation account (Expense/Revenue/etc)
  description       String?
  amount            Decimal @db.Decimal(15, 2) // Always positive, direction determined by Parent Type

  transaction       CashTransaction @relation(fields: [cashTransactionId], references: [id], onDelete: Cascade)
  account           Account         @relation(fields: [accountId], references: [id])

  @@index([cashTransactionId])
}
```

## 2. Updated Models

### JournalSourceType (Enum)

Add `CASH_TRANSACTION` to `JournalSourceType`.

```prisma
enum JournalSourceType {
  // ... existing
  CASH_TRANSACTION
}
```

### IdempotencyScope (Enum)

Add `CASH_TRANSACTION_POST`.

```prisma
enum IdempotencyScope {
  // ... existing
  CASH_TRANSACTION_POST
}
```

### EntityType (AuditLog)

Add `BANK_ACCOUNT`, `CASH_TRANSACTION`.

```prisma
enum EntityType {
  // ... existing
  BANK_ACCOUNT
  CASH_TRANSACTION
}
```

### AuditLogAction

Add actions.

```prisma
enum AuditLogAction {
  // ... existing
  CASH_TRANSACTION_POSTED
  CASH_TRANSACTION_VOIDED
}
```
