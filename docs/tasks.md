# Tasks: Bundle Unit Availability & Quick Add Units

## Overview
Improve ConfirmOrderModal to show bundle component breakdown and allow stock-to-unit conversion.

---

## Tasks

### Phase 1: Backend

- [x] **T1.1** Add `getComponentAvailability` endpoint to rental-bundle router
  - Input: bundleId, orderQuantity
  - Output: components with required/available/shortage counts

### Phase 2: Frontend

- [x] **T2.1** Update ConfirmOrderModal to fetch bundle availability
  - Call getComponentAvailability for each bundle item
  - Aggregate shortages across all bundles

- [x] **T2.2** Display component breakdown in shortage warning
  - Show each component with ✅/❌ status
  - Display available vs required count

- [x] **T2.3** Create QuickAddUnitsModal (Stock-based)
  - Show items with enough stock → can convert
  - Show items without stock → need PO
  - Uses existing convertStock mutation

- [x] **T2.4** Integrate QuickAddUnitsModal into ConfirmOrderModal
  - "Tambah Unit yang Kurang" button
  - Refresh availability after units created

### Phase 3: Polish

- [ ] **T3.1** Handle edge cases
  - Multiple bundles in one order
  - Mix of bundles and individual items
  
- [ ] **T3.2** Test end-to-end flow

---

## Progress Log

### Session 1 - Jan 12, 2026
- Created implementation_plan.md
- Created tasks.md
- Implemented getComponentAvailability endpoint
- Updated ConfirmOrderModal with bundle breakdown UI
- Created QuickAddUnitsModal (proper stock-based approach)
  - Shows items ready to convert (has stock)
  - Shows items needing PO (no stock)
  - Uses existing convertStock mutation
