# Feature Specification: Cash and Bank Management

**Feature Branch**: `042-cash-and-bank`
**Created**: 2026-01-06
**Status**: Draft
**Input**: User description: "fitur cash and bank"

## User Scenarios & Testing

### User Story 1 - Manage Cash & Bank Accounts (Priority: P1)

As a Finance Manager, I want to define multiple cash and bank accounts (e.g., "Petty Cash", "BCA Corporate", "Mandiri Operations") so that I can track balances separately for each real-world account.

**Why this priority**: Essential for accurate bookkeeping. A single "Cash" and "Bank" account is insufficient for operational businesses.

**Integration Scenario**: Create a new Bank Account → Verify it appears in the Chart of Accounts → Verify it is available for selection in payments.

**Acceptance Scenarios**:

1. **Given** I am on the Cash & Bank list, **When** I add a new account "BCA Corporate" with an opening balance, **Then** a new Asset account is created, and the opening balance is reflected (if nonzero).
2. **Given** an existing account, **When** I rename it to "BCA Payroll", **Then** the name is updated across the system.
3. **Given** an account with transactions, **When** I try to delete it, **Then** the system prevents deletion to preserve audit trails.

---

### User Story 2 - Record Direct Expense (Spend Money) (Priority: P1)

As a Finance Staff, I want to record expenses paid directly from a cash/bank account without creating a Supplier Bill (e.g., buying office supplies, paying bank admin fees), so that the ledger reflects the outflow immediately.

**Why this priority**: Many daily transactions do not go through the formal Procurement (PO -> Bill) process.

**Integration Scenario**: Record a "Spend Money" transaction -> Verify Bank Account is credited -> Verify Expense Account is debited -> Verify Journal Entry is created.

**Acceptance Scenarios**:

1. **Given** I am on the "Spend Money" screen, **When** I select "Petty Cash", enter amount 50,000, and select "Office Supplies" (Expense), **Then** the system reduces Petty Cash balance and increases Office Supplies expense.
2. **Given** a direct expense, **When** I post it, **Then** a Journal Entry is automatically generated.

---

### User Story 3 - Record Direct Income (Receive Money) (Priority: P1)

As a Finance Staff, I want to record money received directly into a bank account without a Sales Invoice (e.g., interest income, tax refunds, owner capital injection), so that the balance is accurate.

**Why this priority**: Not all inflows are from customer sales.

**Acceptance Scenarios**:

1. **Given** I am on the "Receive Money" screen, **When** I select "BCA Corporate", enter amount 1,000,000, and select "Other Income" (Revenue), **Then** the system increases BCA Corporate balance and increases Other Income.

---

### User Story 4 - Transfer Funds (Priority: P2)

As a Finance Staff, I want to record transfers between two internal accounts (e.g., withdrawing cash from Bank for Petty Cash), so that both account balances are correct without affecting Profit & Loss.

**Why this priority**: Moving money between internal accounts is a common operation.

**Integration Scenario**: Perform Transfer -> Verify Source Account Credited -> Verify Destination Account Debited.

**Acceptance Scenarios**:

1. **Given** I have 10,000,000 in BCA and 0 in Petty Cash, **When** I transfer 1,000,000 from BCA to Petty Cash, **Then** BCA balance becomes 9,000,000 and Petty Cash becomes 1,000,000.
2. **Given** a transfer, **When** I view the journal, **Then** it shows a Credit to Source and Debit to Destination, with no P&L impact.

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST allow creating, editing, and archiving Cash/Bank accounts, mapping them to the Chart of Accounts.
- **FR-002**: System MUST allow recording "Spend Money" transactions: paying from a Cash/Bank account to one or more allocation accounts (Expense/Liability/Asset).
- **FR-003**: System MUST allow recording "Receive Money" transactions: receiving into a Cash/Bank account from one or more allocation accounts (Revenue/Equity/Asset).
- **FR-004**: System MUST allow recording "Transfer" transactions between two internal Cash/Bank accounts.
- **FR-005**: All Cash/Bank transactions MUST generate a corresponding double-entry Journal Entry automatically upon posting.
- **FR-006**: System MUST prevent usage of "Archived" accounts in new transactions.
- **FR-007**: System MUST validate that transfers have the same amount on both sides (Source/Destination). The MVP supports only transfers between accounts of the same currency.
- **FR-008**: System MUST display the current calculated balance of each Cash/Bank account based on posted transactions.

### Key Entities

- **BankAccount**: Represents a manageble cash/bank container, linked to a GL Account.
- **CashTransaction**: Represents a direct money movement (Spend, Receive, Transfer).

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can create and post a "Spend Money" transaction in under 1 minute.
- **SC-002**: Cash/Bank balances displayed in the module match the General Ledger balances 100% of the time.
- **SC-003**: Transfer transactions result in net zero change to total Assets (Total Debits = Total Credits within Asset class).

## Constitution & Architecture Compliance

### Backend Architecture (Apps/API) - Principles I, II, III, XXI

- [ ] **5-Layer Architecture**: Logic strictly follows Route → Controller → Service → Policy → Repository.
- [ ] **Schema-First**: All new fields defined in `packages/shared` Zod schemas first.
- [ ] **Multi-Tenant**: All DB queries scoped by `companyId`.
- [ ] **Service Purity**: Service layer DOES NOT import `prisma` (uses Repository only).
- [ ] **Policy & Rules**: Business constraints in Policy, pure logic in `rules/`.
- [ ] **Repository Purity**: No business logic in Repository (Data access only).
- [ ] **Anti-Bloat**: No redundant business logic methods added; existing ones updated (XXI).

### Frontend Architecture (Apps/Web) - Principles IV, XI

- [ ] **Feature Isolation**: Logic in `src/features/cash-bank` (not global).
- [ ] **No Business Logic**: Components do not calculate state (render `backendState` only).
- [ ] **API Patterns**: Using `apiAction()` helper (never direct toast/try-catch).
- [ ] **User Safety**: Using `useConfirm()` hook (never `window.confirm`).
- [ ] **State Projection**: UI reflects exact backend state without optimistic guessing (unless specific policy).

### Testing & Quality - Principles XV, XVII

- [ ] **Integration Tests**: Full business flow covered in single `it()` block.
- [ ] **Mock Compliance**: Mocks satisfy all Policy/Service contract expectations.
- [ ] **Financial Precision**: All assertions use `Number()` or `Decimal` aware checks.
- [ ] **Zero-Lag**: No interaction freezes the main thread.
