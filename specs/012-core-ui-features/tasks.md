# Tasks: Core UI Features

**Feature Branch**: `012-core-ui-features`
**Spec**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)

## Phase 1: Setup

- [ ] T001 [Setup] Ensure feature directory structure exists for inventory, finance, and company
  - Verify/Create `apps/web/src/features/inventory/components`
  - Verify/Create `apps/web/src/features/finance/components`
  - Verify/Create `apps/web/src/features/company/components`
  - Verify/Create `apps/web/src/features/company/pages`
  - Verify/Create `apps/web/src/features/company/services`

## Phase 2: Use Cases

### User Story 1: Inventory Operations (Goods Receipt & Adjustment)

**Goal**: Enable users to receive goods and adjust stock.
**Test**: Can successfully increment stock via PO Receipt and Manual Adjustment.

- [ ] T002 [US1] Implement `inventoryService.ts` in `apps/web/src/features/inventory/services/inventoryService.ts`
  - Add `processGoodsReceipt(companyId, payload)` calling `POST /api/inventory/goods-receipt`
  - Add `adjustStock(companyId, payload)` calling `POST /api/inventory/adjust`
- [ ] T003 [US1] Create `GoodsReceiptModal.tsx` in `apps/web/src/features/inventory/components/GoodsReceiptModal.tsx`
  - Use `Dialog` component. Form inputs: `purchaseOrderId` (hidden/prop), `items` list (product, quantity).
  - Use `GoodsReceiptSchema` for validation if available, or manual validation.
- [ ] T004 [US1] Create `StockAdjustmentModal.tsx` in `apps/web/src/features/inventory/components/StockAdjustmentModal.tsx`
  - Use `Dialog`. inputs: Product (select), Quantity, Type (Inc/Dec/Set), Reason.
- [ ] T005 [US1] Integrate `GoodsReceiptModal` into `PurchaseOrders.tsx` in `apps/web/src/features/procurement/pages/PurchaseOrders.tsx`
  - Add "Receive" button to PO row actions or detail view.
- [ ] T006 [US1] Integrate `StockAdjustmentModal` into `Inventory.tsx` in `apps/web/src/features/inventory/pages/Inventory.tsx`
  - Add "Adjust" button to inventory table row actions.

### User Story 2: Payment History

**Goal**: View past payments for Invoices/Bills.
**Test**: Payment list loads correctly for an Invoice.

- [ ] T007 [US2] Update `paymentService.ts` in `apps/web/src/features/finance/services/paymentService.ts`
  - Add `getPaymentHistory(invoiceId)` calling `GET /api/payments/invoice/:id`.
- [ ] T008 [US2] Create `PaymentHistoryList.tsx` in `apps/web/src/features/finance/components/PaymentHistoryList.tsx`
  - Props: `invoiceId`, `totalAmount`. Fetch data using `useQuery` key `['payments', invoiceId]`.
  - Render simple table: Date, Amount, Method, Reference.
  - Calculate and display "Remaining Balance" (Total - Sum of Payments) [FR-006].
- [ ] T009 [US2] Integrate `PaymentHistoryList` into `Invoices.tsx` (Details) in `apps/web/src/features/finance/pages/Invoices.tsx`
  - Add section below Invoice details. Pass `invoice.totalAmount` to component.
- [ ] T010 [US2] Integrate `PaymentHistoryList` into `AccountsPayable.tsx` (Bill Details) in `apps/web/src/features/finance/pages/AccountsPayable.tsx`
  - Add section below Bill details. Pass `bill.totalAmount` to component.

### User Story 3: Team Management

**Goal**: Invite and Assign users.
**Test**: Can invite a user and see them in the list.

- [ ] T011 [US3] Create `userService.ts` in `apps/web/src/features/company/services/userService.ts`
  - Add `listByCompany(companyId)` (`GET /api/users`)
  - Add `invite(companyId, email, name)` (`POST /api/users`)
  - Add `assign(companyId, userId, roleId)` (`POST /api/users/:id/assign`)
- [ ] T012 [US3] Create `InviteUserModal.tsx` in `apps/web/src/features/company/components/InviteUserModal.tsx`
  - Form: Email, Name. Calls `userService.invite`.
- [ ] T013 [US3] Create `AssignCompanyModal.tsx` in `apps/web/src/features/company/components/AssignCompanyModal.tsx`
  - Form: Select Company (target), User (target). Calls `userService.assign`.
- [ ] T014 [US3] Create `UserList.tsx` in `apps/web/src/features/company/components/UserList.tsx`
  - Table of users. Columns: Name, Email, Assigned Companies.
  - Action: "Assign to Company".
- [ ] T015 [US3] Create `TeamManagement.tsx` page in `apps/web/src/features/company/pages/TeamManagement.tsx`
  - Layout: Header "Team Members" + "Invite User" button.
  - Body: `<UserList />`.
- [ ] T016 [US3] Register path `/team` in `apps/web/src/app/AppRouter.tsx`
  - Route to `TeamManagement`.
- [ ] T017 [US3] Add "Team" link to `apps/web/src/components/layout/Sidebar.tsx`
  - Icon: Users/Group icon.

## Phase 3: Polish

- [ ] T018 [Polish] Verify `useConfirm` usage
  - Ensure critical actions (stock adjust, assign user) utilize the confirmation modal.
- [ ] T019 [Polish] Verify Loading States
  - Ensure tables show skeletons or loading spinners.
  - Ensure buttons show loading state during submissions.

## Implementation Strategy

- Implement US1 (Inventory) first as it has highest business impact (stock accuracy).
- Follow with US2 (Payments) for financial visibility.
- Finish with US3 (Team) to enable multi-user testing.
