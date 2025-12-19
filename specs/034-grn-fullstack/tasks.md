# Tasks: 034-grn-fullstack

**Status**: Draft
**Validation**:

- [ ] All tasks have IDs (e.g., T001)
- [ ] All tasks have file paths
- [ ] User stories are separated

## Phase 1: Setup

- [x] T001 Update Prisma schema with `GoodsReceipt` and `Shipment` models in packages/database/prisma/schema.prisma
- [x] T002 Generate Prisma client and migrate DB in packages/database/ (run `npm run db:push`)
- [x] T003 Create Zod schemas for GRN/Shipment in packages/shared/src/validators/inventory.ts
- [x] T004 Export new types/validators in packages/shared/src/index.ts

## Phase 2: Foundation (Shared)

- [x] T005 Create Inventory module structure in apps/api/src/modules/inventory/ (service.ts, controller.ts, repository.ts)
- [x] T006 Implement `StockJournal` helper in InventoryRepository for unified IN/OUT logic in apps/api/src/modules/inventory/repository.ts
- [x] T007 Register Inventory routes in apps/api/src/routes/inventory.ts

## Phase 3: User Story 1 - P2P/GRN (Priority P1)

**Goal**: Record Goods Receipt to increase stock.
**Independent Test**: `npm test apps/api/test/integration/p2p-flow.test.ts`

### Tests

- [ ] T008 [US1] Create integration test skeleton for P2P flow in apps/api/test/integration/p2p-flow.test.ts

### Backend

- [x] T009 [US1] Implement `createGoodsReceipt` in apps/api/src/modules/inventory/repository.ts
- [x] T010 [US1] Implement `postGoodsReceipt` (Transaction: Update Status + Stock IN + Cost Update) in apps/api/src/modules/inventory/repository.ts
- [x] T011 [US1] Implement `InventoryService.createGRN` with Policy check (Order Confirmed) in apps/api/src/modules/inventory/service.ts
- [x] T012 [US1] Implement `InventoryService.postGRN` in apps/api/src/modules/inventory/service.ts
- [x] T013 [US1] Add API endpoints `POST /receipts` and `POST /receipts/:id/post` in apps/api/src/modules/inventory/controller.ts

### Frontend

- [x] T014 [US1] Create/Update `GoodsReceiptModal` to use new API in apps/web/src/features/inventory/components/GoodsReceiptModal.tsx
- [x] T015 [US1] Add "Receive" action to `PurchaseOrderDetail` logic in apps/web/src/features/procurement/pages/PurchaseOrderDetail.tsx

## Phase 4: User Story 2 - O2C/Shipment (Priority P1)

**Goal**: Record Shipment to decrease stock.
**Independent Test**: `npm test apps/api/test/integration/o2c-flow.test.ts`

### Tests

- [ ] T016 [US2] Create integration test skeleton for O2C flow in apps/api/test/integration/o2c-flow.test.ts

### Backend

- [x] T017 [US2] Implement `createShipment` in apps/api/src/modules/inventory/repository.ts
- [x] T018 [US2] Implement `postShipment` (Transaction: Update Status + Stock OUT + Cost Snapshot) in apps/api/src/modules/inventory/repository.ts
- [x] T019 [US2] Implement `InventoryService.createShipment` with Policy check (Order Confirmed, Stock Avail) in apps/api/src/modules/inventory/service.ts
- [x] T020 [US2] Implement `InventoryService.postShipment` in apps/api/src/modules/inventory/service.ts
- [x] T021 [US2] Add API endpoints `POST /shipments` and `POST /shipments/:id/post` in apps/api/src/modules/inventory/controller.ts

### Frontend

- [x] T022 [US2] Create `ShipmentModal` to allow shipping from SO in apps/web/src/features/inventory/components/ShipmentModal.tsx
- [x] T023 [US2] Add "Ship" action to `SalesOrderDetail` logic in apps/web/src/features/sales/pages/SalesOrderDetail.tsx

## Phase 5: User Story 3 - Lists & Details (Priority P2)

**Goal**: Audit views for Receipts and Shipments.

### Backend

- [ ] T024 [US3] Implement `listReceipts` and `getReceiptById` in apps/api/src/modules/inventory/repository.ts
- [ ] T025 [US3] Implement `listShipments` and `getShipmentById` in apps/api/src/modules/inventory/repository.ts
- [ ] T026 [US3] Add GET endpoints for lists/details in apps/api/src/modules/inventory/controller.ts

### Frontend

- [ ] T027 [US3] Create `ReceiptsList` page in apps/web/src/features/inventory/pages/ReceiptsList.tsx
- [ ] T028 [US3] Create `ReceiptDetail` page in apps/web/src/features/inventory/pages/ReceiptDetail.tsx
- [ ] T029 [US3] Create `ShipmentsList` page in apps/web/src/features/inventory/pages/ShipmentsList.tsx
- [ ] T030 [US3] Create `ShipmentDetail` page in apps/web/src/features/inventory/pages/ShipmentDetail.tsx
- [ ] T031 [US3] Register new routes in apps/web/src/app/routes.tsx

## Final Phase: Polish

- [ ] T032 Ensure all texts are externalized/consistent
- [ ] T033 Verify Optimistic UI updates on Create/Post actions
- [ ] T034 Run full regression suite `npm test`

## Dependencies

- US2 depends on US1 (technically parallel, but better to stabilize StockJournal first)
- US3 depends on Backend lists (T24-26) being ready

## Parallel Execution

- T009 (Repo) and T014 (FE Modal) can be built in parallel if API contract is agreed
- T017 (Repo) and T022 (FE Modal) can be built in parallel
