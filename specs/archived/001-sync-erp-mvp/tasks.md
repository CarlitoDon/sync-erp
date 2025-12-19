---
description: 'Implementation tasks for Sync ERP MVP'
---

# Tasks: Sync ERP MVP

**Input**: Design documents from `/specs/001-sync-erp-mvp/`
**Prerequisites**: plan.md (required), spec.md (required), data-model.md, contracts/

## Organization

Tasks are grouped by User Story (US) to enable independent implementation.
**P1** stories are MVP critical.

## Phase 1: Setup (Shared Infrastructure) ✅

**Purpose**: Project initialization and Monorepo structure (npm workspaces).

- [x] T001 Create `package.json` with npm workspaces (`apps/*`, `packages/*`)
- [x] T002 Setup root `tsconfig.base.json` and `.eslintrc.js`
- [x] T003 Configure `turbo.json` for build pipeline
- [x] T004 [P] Initialize `packages/shared` (Utils, Constants)
- [x] T005 [P] Initialize `packages/database` (Prisma, TS Config)
- [x] T006 [P] Initialize `apps/api` (Express, TypeScript)
- [x] T007 [P] Initialize `apps/web` (Vite, React, TailwindCSS)

---

## Phase 2: Foundational (Blocking Prerequisites) ✅

**Purpose**: Core infrastructure that must strictly follow Constitution (Layered Backend, M:N User-Company, Shared Types).

- [x] T008 Define core Prisma Schema (User, Company, CompanyMember) in `packages/database`
- [x] T009 Run `npm run db:generate` and migration for Core
- [x] T010 [P] Define `Zod` schemas in `packages/shared` (from `contracts/zod-schemas.ts`)
- [x] T011 Implement `PrismaClient` singleton in `packages/database`
- [x] T012 Implement Global Error Handler (including Zod Error Mapping) & Response Wrapper in `apps/api`
- [x] T013 Implement Auth Middleware (Mock/Simple) with `CompanyId` header extraction in `apps/api`
- [x] T014 Setup Axios instance with Interceptors (Context Headers) in `apps/web`
- [x] T014b [P] Seed Default RBAC Roles & Permissions in `packages/database/seed.ts`

**Checkpoint**: Backend can connect to DB, Frontend can call API.

---

## Phase 3: User Story 1 - Multi-Company Setup (Priority: P1) 🎯 MVP

**Goal**: Create and switch between companies with strict data isolation.

**Independent Test**: Create Company A & B. Create User linked to both. Verify Context Switching.

### Implementation

- [x] T015 [US1] Implement `CompanyService` (Create, List for User) in `apps/api`
- [x] T016 [US1] Implement `UserService` (Create, Assign to Company) in `apps/api`
- [x] T017 [US1] Create API Endpoints for `/companies` and `/users` in `apps/api`
- [x] T018 [US1] Implement "Create Company" Page in `apps/web`
- [x] T019 [US1] Implement "Company Switcher" in Global Header in `apps/web`
- [x] T020 [P] [US1] Integration Test: Verify data isolation between companies (Manual/Script)

---

## Phase 4: User Story 2 - Procure to Pay (Priority: P1)

**Goal**: Purchasing -> Warehousing -> Accounts Payable.

**Independent Test**: Run PO -> Receipt -> Bill -> Payment cycle.

### Implementation

- [x] T021 [US2] Update Prisma Schema (Partner, Product, Order, InvMovement, Invoice, Payment)
- [x] T022 [P] [US2] Implement `PartnerService` (Supplier CRUD)
- [x] T023 [P] [US2] Implement `ProductService` (CRUD + AverageCost field)
- [x] T024 [US2] Implement `PurchaseOrderService` (Create, Approve)
- [x] T025 [US2] Implement `InventoryService` (Goods Receipt -> Increase Stock + Update AVCO)
- [x] T026 [US2] Implement `BillService` (Create Configurable Bill from PO)
- [x] T027 [US2] Frontend: Supplier & Product Master Data Forms
- [x] T028 [US2] Frontend: Purchase Order Creation & Approval UI
- [x] T029 [US2] Frontend: Goods Receipt Dashboard
- [x] T029b [US2] Frontend: Product Stock Level View in `apps/web`

---

## Phase 5: User Story 3 - Order to Cash (Priority: P1)

**Goal**: Sales -> Warehousing -> Accounts Receivable.

**Independent Test**: Run SO -> Shipment -> Invoice -> Payment cycle.

### Implementation

- [x] T030 [P] [US3] Implement `CustomerService` (Reuse PartnerService logic)
- [x] T031 [US3] Implement `SalesOrderService` (Create, Confirm, Check Stock)
- [x] T032 [US3] Implement `FulfillmentService` (Delivery Note -> Decrease Stock)
- [x] T033 [US3] Implement `InvoiceService` (Generate from SO, Apply Flat Tax)
- [x] T034 [US3] Implement `PaymentService` (Record Payment against Invoice)
- [x] T035 [US3] Frontend: Sales Order Form
- [x] T036 [US3] Frontend: Invoice View & Payment Action

---

## Phase 6: User Story 4 - Financial Reporting (Priority: P1)

**Goal**: Double-entry accounting visibility.

**Independent Test**: Verify Trial Balance (Debits = Credits).

### Implementation

- [x] T037 [US4] Update Prisma Schema (JournalEntry, JournalLine) if needed
- [x] T037b [US4] Seed Default Chart of Accounts in `packages/database/seed.ts`
- [x] T038 [US4] Implement `JournalService` (Auto-posting triggers on Invoice/Bill/Payment)
- [x] T039 [US4] Implement `ReportService` (Trial Balance Calculation)
- [x] T039b [US4] Frontend: Chart of Accounts Management UI in `apps/web`
- [x] T040 [US4] Frontend: GL & Trial Balance Report Page

---

## Phase 7: Polish & Cross-Cutting

- [x] T041 Implement Format-driven Document Numbering (Prefix/Year/Seq)
- [x] T042 Implement RBAC (Granular Permissions) checks in Middleware
- [x] T043 Final E2E Validation of all flows
