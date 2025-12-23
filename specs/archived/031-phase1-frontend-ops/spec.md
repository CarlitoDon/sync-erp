# Feature Specification: Phase 1 Frontend Operational UI & Observability

**Feature Branch**: `031-phase1-frontend-ops`  
**Created**: 2025-12-17  
**Status**: Draft  
**Input**: ROADMAP Sections 4 & 5 - Minimal operational screens with UI guardrails and admin visibility

## Overview

This feature delivers the **minimum viable frontend** for Phase 1 daily operations. The philosophy is "No magic, no auto-anything" – every screen is explicit, every irreversible action is guarded, and administrators have visibility into system health through saga and journal monitoring.

**Guiding Principle**: Make irreversible actions uncomfortable.

---

## Core Principles (Constitution Alignment)

> These principles are **non-negotiable** and derived from Phase 1 Constitution.

1. **Error > Corruption**: System MUST reject invalid operations with clear errors rather than silently correct or ignore issues
2. **Backend Owns Reality**: Frontend MUST NOT calculate balances, determine final status, or make state decisions
3. **Failure Is Visible**: When operations fail, users MUST see clear indication of failure state
4. **No Side Effect Without Policy**: All state changes go through backend Policy layer validation

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - View Dashboard KPIs (Priority: P1)

As a business user, I want to see a read-only dashboard with key performance indicators so I can quickly understand business health without navigating multiple screens.

**Why this priority**: Dashboard is the entry point for all users. Provides immediate value and orientation.

**Independent Test**: Can be fully tested by logging in and verifying KPI data displays correctly from existing invoices, orders, and payments.

**Acceptance Scenarios**:

1. **Given** a logged-in user with company context, **When** they navigate to Dashboard, **Then** they see KPIs for: Total Sales, Outstanding Receivables, Outstanding Payables, Inventory Value
2. **Given** the dashboard is displayed, **When** data changes in the backend, **Then** the dashboard reflects updated values on page refresh
3. **Given** no data exists for a KPI, **When** dashboard loads, **Then** the KPI shows "0" or "N/A" (not an error)

---

### User Story 2 - Manage Sales Invoices (Priority: P1)

As a sales user, I want to view a list of invoices, see invoice details, and record payments so I can manage the accounts receivable workflow.

**Why this priority**: Core O2C (Order-to-Cash) functionality. Essential for daily operations.

**Independent Test**: Can be fully tested by creating invoices, viewing the list, opening details, and recording payments.

**Acceptance Scenarios**:

1. **Given** a user on the Invoice List, **When** they view the page, **Then** they see all invoices with: Invoice Number, Customer, Amount, Balance, Status
2. **Given** an invoice in POSTED status, **When** user clicks on it, **Then** Invoice Detail screen shows full breakdown with Payment History
3. **Given** Invoice Detail for a POSTED invoice with balance > 0, **When** user clicks "Record Payment", **Then** Payment Modal opens with businessDate field defaulted to today
4. **Given** Payment Modal is open, **When** user enters valid amount and businessDate and confirms, **Then** payment is recorded and invoice balance updates
5. **Given** an invoice in DRAFT status, **When** user views it, **Then** "Record Payment" button is disabled
6. **Given** Payment Modal submit button was clicked, **When** request is in-flight, **Then** button is disabled to prevent double-click

---

### User Story 3 - Manage Purchase Orders & Goods Receipt (Priority: P1)

As a procurement user, I want to view purchase orders and record goods receipt so I can manage the P2P (Procure-to-Pay) workflow.

**Why this priority**: Core P2P functionality. Essential for inventory and payables management.

**Independent Test**: Can be fully tested by creating POs, viewing the list, and recording goods receipt.

**Acceptance Scenarios**:

1. **Given** a user on PO List, **When** they view the page, **Then** they see all POs with: PO Number, Supplier, Total Amount, Status
2. **Given** a PO in CONFIRMED status, **When** user clicks "Receive Goods", **Then** Receive Goods Screen opens with businessDate field defaulted to today
3. **Given** Receive Goods Screen, **When** user enters received quantities, selects businessDate, and confirms, **Then** stock is updated and GRN is created
4. **Given** a PO in DRAFT status, **When** user views it, **Then** "Receive Goods" button is disabled
5. **Given** Receive Goods confirm button was clicked, **When** request is in-flight, **Then** button is disabled to prevent double-click

---

### User Story 4 - UI Guardrails for Safe Operations (Priority: P2)

As a user performing financial operations, I want visual cues and confirmations for irreversible actions so I don't accidentally corrupt data.

**Why this priority**: Safety mechanism that prevents costly mistakes. Important but depends on base screens existing.

**Independent Test**: Can be tested by attempting state-changing operations and verifying guards are present.

**Acceptance Scenarios**:

1. **Given** any screen with action buttons, **When** the entity is in a state that disallows the action, **Then** the button is visually disabled with tooltip explaining why
2. **Given** user attempts to post an invoice, **When** they click "Post", **Then** confirmation modal appears with warning: "This action cannot be undone"
3. **Given** user attempts to void an invoice, **When** they click "Void", **Then** confirmation modal appears with RED warning styling
4. **Given** company has `businessShape = PENDING`, **When** user accesses any operational screen, **Then** a persistent banner warns "Business configuration incomplete"
5. **Given** a backend operation fails, **When** error response is received, **Then** user sees clear error message (not silent failure)
6. **Given** any form submit button, **When** request is in-flight, **Then** button shows loading state and is disabled

---

### User Story 5 - Admin Observability Dashboard (Priority: P3)

As an administrator, I want to view saga failures, compensation status, and journal integrity so I can identify and resolve system issues.

**Why this priority**: Operational visibility for troubleshooting. Less critical than core workflows but important for system health.

**Independent Test**: Can be tested by simulating saga failures and verifying they appear in admin views.

**Acceptance Scenarios**:

1. **Given** an admin user, **When** they access Observability section, **Then** they see: Saga Failures, Compensation Status, Journal Orphans
2. **Given** a failed saga exists, **When** admin views Saga Failures, **Then** they see: Saga Type, Entity ID, Error Message, Timestamp
3. **Given** a compensated saga exists, **When** admin views Compensation Status, **Then** it shows as "Compensated" with original error
4. **Given** journal entries without valid sourceType/sourceId, **When** admin views Orphan Journals, **Then** they are listed for investigation

---

### Edge Cases

- What happens when user attempts to pay more than invoice balance? → **Validation blocks with clear error message**
- What happens when goods receipt quantity exceeds PO quantity? → **Allowed (over-receipt) with warning confirmation**
- How does system handle concurrent payment attempts? → **Saga row lock prevents double-payment**
- What happens when KPI data takes too long to load? → **Skeleton loaders shown, no UI freeze**
- What happens when user double-clicks submit button? → **Button disabled during request, second click ignored**
- What happens when backend operation fails? → **User sees error toast with message, no silent failure**

---

## Requirements _(mandatory)_

### Functional Requirements

**Dashboard**

- **FR-001**: System MUST display read-only KPIs: Total Sales, Outstanding AR, Outstanding AP, Inventory Value
- **FR-002**: Dashboard MUST refresh data on page load (no auto-refresh)

**Invoice Management**

- **FR-003**: System MUST display Invoice List with columns: Number, Customer, Amount, Balance, Status
- **FR-004**: System MUST provide Invoice Detail view with line items and payment history
- **FR-005**: System MUST provide Payment Modal for POSTED invoices with balance > 0
- **FR-005a**: Payment Modal MUST include businessDate field (default: today)
- **FR-006**: System MUST validate payment amount does not exceed invoice balance
- **FR-006a**: Payment submit button MUST be disabled while request is in-flight

**Purchase Order & GRN**

- **FR-007**: System MUST display PO List with columns: Number, Supplier, Total, Status
- **FR-008**: System MUST provide Receive Goods screen for CONFIRMED POs
- **FR-008a**: Receive Goods screen MUST include businessDate field (default: today)
- **FR-009**: System MUST update stock quantities upon goods receipt confirmation
- **FR-009a**: Receive Goods submit button MUST be disabled while request is in-flight

**UI Guardrails**

- **FR-010**: System MUST disable action buttons when entity state disallows the action
- **FR-011**: System MUST show confirmation modals for all irreversible actions (Post, Void, Delete)
- **FR-012**: System MUST display Pending Shape banner when `businessShape = PENDING`
- **FR-013**: Confirmation modals for destructive actions MUST use warning/danger styling

**Observability (Admin Only)**

- **FR-014**: System MUST display list of failed sagas with error details
- **FR-015**: System MUST distinguish compensated vs compensation-failed sagas
- **FR-016**: System MUST display journal entries with missing/invalid source references

**Constitution Guardrails**

- **FR-017**: Frontend MUST NOT calculate or determine final entity status (balance, PAID status, stock levels)
- **FR-018**: All backend errors MUST be displayed to user (no silent failures)
- **FR-019**: All submit buttons MUST be disabled during in-flight requests to prevent double-submission

### Key Entities

- **Dashboard KPIs**: Aggregated metrics from Invoice, Bill, Stock tables (read-only)
- **Invoice**: Customer receivable with status workflow (DRAFT → POSTED → PAID → VOID)
- **Payment**: Cash receipt against an invoice
- **PurchaseOrder**: Supplier order with status workflow (DRAFT → CONFIRMED → COMPLETED)
- **GoodsReceipt**: Stock movement from PO receipt
- **SagaLog**: Saga execution status and step data (admin visibility)
- **JournalEntry**: Accounting entries with sourceType/sourceId linkage

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can view invoice list and details within 2 seconds of page load
- **SC-002**: Users can complete a payment recording in under 1 minute
- **SC-003**: Users can complete goods receipt in under 2 minutes
- **SC-004**: 100% of irreversible actions require explicit confirmation click
- **SC-005**: Zero accidental data corruption from UI (no unguarded state changes)
- **SC-006**: Administrators can identify all failed sagas within 30 seconds
- **SC-007**: All screens render correctly without JavaScript errors

---

## Constitution Compliance _(mandatory for frontend features)_

### Technical Architecture Checklist (Part A)

- [ ] **Feature Isolation**: Logic in `src/features` (not global pages/components)
- [ ] **Component Abstraction**: Any repeated UI pattern extracted to reusable `ui` component
- [ ] **Hook Abstraction**: Any repeated logic extracted to custom hook
- [ ] **No Copy-Paste**: No duplicate button styles, error handling, or API patterns
- [ ] **Global Error Handling**: Errors handled via Axios interceptor, not per-page try-catch
- [ ] **Success Toasts**: Using `apiAction()` helper, not direct toast imports
- [ ] **Confirmation Dialogs**: Using `useConfirm()` hook, not native `window.confirm()`
- [ ] **Systematic Updates**: All instances updated when changing patterns (grep verified)

### Human Experience Checklist (Part B - Principles XIV-XVII)

- [ ] **Simplicity & Clarity**: Ruthlessly cut non-essential features/fields. Only show what matters NOW.
- [ ] **Clear Navigation**: User never wonders "where am I?" or "what do I do next?".
- [ ] **Simplified Workflows**: Complex tasks broken into linear, bite-sized steps (Wizards).
- [ ] **Assistance**: Smart suggestions provided where possible (e.g., "Reorder based on history?").
- [ ] **Zero-Lag**: No interaction freezes the UI. Heavy work is backgrounded.
- [ ] **Pixel Perfection**: Alignment, spacing, typography are consistent.

---

## Out of Scope (Phase 1)

The following are explicitly **NOT** included in this feature:

- ❌ Drag-and-drop interfaces
- ❌ Inline editing of POSTED entities
- ❌ Batch operations
- ❌ Real-time auto-refresh
- ❌ Complex dashboards with charts/graphs
- ❌ Approval workflows
- ❌ Multi-currency display
- ❌ Reporting engine integration

---

## Assumptions

1. All screens use existing shared components (`Button`, `Modal`, `Table`, etc.)
2. Authentication and company context are already handled by existing middleware
3. The Pending Shape banner component already exists per Memory
4. Backend APIs for Invoice, Payment, PO, and GRN already exist and are saga-protected
5. Observability data is accessed via direct database queries (no separate API initially)
