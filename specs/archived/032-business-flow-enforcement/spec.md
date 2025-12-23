# Feature: Business Flow Enforcement

**Version**: 1.0.0  
**Status**: Draft  
**Created**: 2025-12-18

---

## Problem Statement

The current system allows business operations to occur out of sequence, violating fundamental ERP business logic:

### Observed Violations

| #   | Violation                    | What Happened                                                    | Expected Behavior                                 |
| --- | ---------------------------- | ---------------------------------------------------------------- | ------------------------------------------------- |
| 1   | Bill without GRN             | PO is CONFIRMED but no GRN done, yet Bill already exists (DRAFT) | Bill can only be created AFTER goods are received |
| 2   | No inventory update          | GRN not processed, inventory still empty                         | GRN must add stock before any downstream document |
| 3   | Invoice without confirmation | SO is still DRAFT, but Invoice already exists                    | Invoice can only be created from CONFIRMED SO     |
| 4   | Invoice paid without stock   | Invoice is PAID but no stock available to ship                   | Invoice posting must validate sufficient stock    |

### Root Cause Analysis

```
PROCUREMENT FLOW (Expected):
PO.DRAFT → PO.CONFIRMED → GRN → Inventory.IN → Bill.DRAFT → Bill.POSTED → Payment

SALES FLOW (Expected):
SO.DRAFT → SO.CONFIRMED → Invoice.DRAFT → Invoice.POSTED (ships goods) → Payment

CURRENT ISSUES:
1. Bill can be created without GRN prerequisite check
2. Invoice can be created without SO CONFIRMED prerequisite check
3. API endpoints allow creation at any parent status
```

---

## User Scenarios

### Scenario 1: Procurement Manager Creates Bill

**Given** a Purchase Order exists with status CONFIRMED  
**When** the user attempts to create a Bill  
**Then** the system should ONLY allow Bill creation if GRN has been processed for that PO  
**And** if no GRN exists, show error: "Cannot create bill: Goods have not been received"

### Scenario 2: Sales Manager Creates Invoice

**Given** a Sales Order exists with status DRAFT  
**When** the user attempts to create an Invoice  
**Then** the system should REJECT with error: "Cannot create invoice: Order is not confirmed"

### Scenario 3: Sales Manager Posts Invoice

**Given** an Invoice exists for a confirmed Sales Order  
**When** the user attempts to post the Invoice  
**Then** the system should ONLY post if sufficient stock exists  
**And** if stock is insufficient, show error: "Insufficient stock for 'Product X': required N, available M"

---

## Functional Requirements

### FR-001: Bill Creation Prerequisites

The system must validate before creating a Bill:

- [ ] Parent PO exists
- [ ] Parent PO status is CONFIRMED or RECEIVED
- [ ] At least one GRN exists for the PO (goods have been received)

**Error Response**: `400 Bad Request` with message explaining missing prerequisite.

### FR-002: Invoice Creation Prerequisites

The system must validate before creating an Invoice:

- [ ] Parent SO exists
- [ ] Parent SO status is CONFIRMED, SHIPPED, or COMPLETED

**Error Response**: `400 Bad Request` with message explaining missing prerequisite.

### FR-003: Invoice Post Prerequisites

The system must validate before posting an Invoice:

- [ ] All items in the linked SO have sufficient stock
- [ ] This validation must happen BEFORE any stock deduction

**Error Response**: `400 Bad Request` with product-specific stock error.

### FR-004: GRN Must Update Inventory

When goods are received via GRN:

- [ ] Inventory movements (IN) must be created
- [ ] Product stockQty must be incremented
- [ ] If GRN fails, no partial inventory updates remain

### FR-005: Flow State Machine

Each document type must enforce a valid state machine:

**Purchase Order States**:

```
DRAFT → CONFIRMED → RECEIVED → BILLED → PAID
                 ↓
              CANCELLED
```

**Sales Order States**:

```
DRAFT → CONFIRMED → SHIPPED → INVOICED → PAID
                 ↓
              CANCELLED
```

---

## Success Criteria

| Criterion             | Metric                              | Target          |
| --------------------- | ----------------------------------- | --------------- |
| No orphan documents   | Bills without GRN                   | 0               |
| No premature invoices | Invoices from DRAFT orders          | 0               |
| Stock validation      | Invoice post failures without stock | 100% blocked    |
| Data integrity        | Journal entries match document flow | 100% consistent |

---

## Key Entities Affected

| Entity            | Changes Required                                    |
| ----------------- | --------------------------------------------------- |
| Order             | Add state validation before downstream doc creation |
| Invoice           | Add prerequisite check for SO status                |
| Bill              | Add prerequisite check for GRN existence            |
| InventoryMovement | Ensure atomic creation with GRN                     |

---

## Assumptions

1. GRN (Goods Receipt Note) is the mechanism for receiving goods in procurement flow
2. A PO can have multiple GRNs (partial receipts)
3. Bill amount should match received goods, not ordered goods
4. Invoice posting is the point where stock is deducted (shipment)

---

## Out of Scope

- [ ] Multi-partial invoice support
- [ ] Credit notes and returns
- [ ] Inter-warehouse transfers

---

## Technical Notes

### Files to Investigate

| File                                                          | Purpose                |
| ------------------------------------------------------------- | ---------------------- |
| `apps/api/src/modules/accounting/services/invoice.service.ts` | Invoice creation logic |
| `apps/api/src/modules/accounting/services/bill.service.ts`    | Bill creation logic    |
| `apps/api/src/modules/inventory/inventory.service.ts`         | GRN processing         |
| `apps/api/src/modules/sales/sales.service.ts`                 | SO status management   |
| `apps/api/src/modules/procurement/procurement.service.ts`     | PO status management   |

### Proposed Solution Approach

1. **Add prerequisite validation in Bill creation**:
   - Check if any GRN exists for the orderId before allowing bill creation

2. **Add prerequisite validation in Invoice creation**:
   - Check if SO status is CONFIRMED or beyond before allowing invoice creation

3. **Stock validation already added** in `InventoryService.processShipment` via `InventoryPolicy.ensureSufficientStock`

4. **Consider creating Policy classes** for Sales and Procurement flows to centralize these rules
