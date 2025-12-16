# Implementation Plan: SAGA Transaction Safety

## Meta

| Property   | Value                       |
| ---------- | --------------------------- |
| Feature ID | 022                         |
| Branch     | 022-saga-transaction-safety |
| Created    | 2025-12-16                  |
| Updated    | 2025-12-16                  |
| Status     | Planning Complete           |

---

## Technical Context

| Aspect             | Value                                       |
| ------------------ | ------------------------------------------- |
| Backend Framework  | Express + TypeScript                        |
| ORM                | Prisma                                      |
| Database           | PostgreSQL                                  |
| Pattern            | Orchestrated Saga with Step Tracking        |
| Existing Reversals | Credit Note, Stock Return, Journal Reversal |

---

## Constitution Check

| Principle                | Compliance | Notes                               |
| ------------------------ | ---------- | ----------------------------------- |
| III. Layered Backend     | ✅         | Saga is service-layer orchestration |
| VI. Transaction Boundary | ✅         | Compensating transactions           |
| VIII. Audit Trail        | ✅         | SagaLog captures all steps          |
| X. Modular Parity        | ✅         | All modules get saga where needed   |

---

## Phase Overview

| Phase     | Scope                       | Sagas                                     | Effort     |
| --------- | --------------------------- | ----------------------------------------- | ---------- |
| 1         | Infrastructure              | SagaLog, PostingContext, Orchestrator     | 2h         |
| 2         | Critical Path (Sales)       | Invoice Posting, Shipment                 | 3h         |
| 3         | Critical Path (Procurement) | Goods Receipt, Bill Posting               | 3h         |
| 4         | Critical Path (Accounting)  | Payment Posting                           | 1.5h       |
| 5         | High Priority               | Credit Note, Stock Transfer, Stock Return | 3h         |
| 6         | Testing & Polish            | All tests, verification                   | 2h         |
| **Total** |                             | **8 Sagas**                               | **~14.5h** |

---

## Proposed Changes

### Phase 1: Core Infrastructure

#### [NEW] Schema Changes

```prisma
model SagaLog {
  id        String   @id @default(uuid())
  sagaType  SagaType
  entityId  String
  companyId String
  step      SagaStep
  stepData  Json?
  error     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([entityId])
  @@index([companyId, sagaType, step])
}

enum SagaType {
  INVOICE_POST
  SHIPMENT
  GOODS_RECEIPT
  BILL_POST
  PAYMENT_POST
  CREDIT_NOTE
  STOCK_TRANSFER
  STOCK_RETURN
}

enum SagaStep {
  PENDING
  STOCK_DONE
  BALANCE_DONE
  JOURNAL_DONE
  COMPLETED
  FAILED
  COMPENSATION_FAILED
}
```

#### [NEW] `apps/api/src/modules/common/saga/`

| File                     | Purpose             |
| ------------------------ | ------------------- |
| `saga-log.repository.ts` | CRUD for SagaLog    |
| `posting-context.ts`     | Step tracking class |
| `saga-orchestrator.ts`   | Abstract base class |

---

### Phase 2: Sales Sagas

#### [NEW] Invoice Posting Saga

`apps/api/src/modules/accounting/sagas/invoice-posting.saga.ts`

```
Steps: Stock OUT → Journal (Revenue, AR) → Complete
Compensation: Reverse journal → Restore stock
```

#### [NEW] Shipment Saga

`apps/api/src/modules/sales/sagas/shipment.saga.ts`

```
Steps: Validate stock → Stock OUT → Movement log → Order status
Compensation: Restore stock → Rollback movement
```

#### [MODIFY] Services

- `invoice.service.ts` - Use InvoicePostingSaga
- `order.service.ts` - Use ShipmentSaga for ship()

---

### Phase 3: Procurement Sagas

#### [NEW] Goods Receipt Saga

`apps/api/src/modules/procurement/sagas/goods-receipt.saga.ts`

```
Steps: Stock IN → Accrual journal → PO status update
Compensation: Decrease stock → Reverse accrual
```

#### [NEW] Bill Posting Saga

`apps/api/src/modules/accounting/sagas/bill-posting.saga.ts`

```
Steps: Validate receipt → AP Journal → Complete
Compensation: Reverse journal
```

#### [MODIFY] Services

- `goods-receipt.service.ts` - Use GoodsReceiptSaga
- `bill.service.ts` - Use BillPostingSaga

---

### Phase 4: Accounting Saga

#### [NEW] Payment Posting Saga

`apps/api/src/modules/accounting/sagas/payment-posting.saga.ts`

```
Steps: Decrease balance → Cash journal → Complete
Compensation: Restore balance → Reverse journal
```

#### [MODIFY] Services

- `payment.service.ts` - Use PaymentPostingSaga

---

### Phase 5: High Priority Sagas

#### [NEW] Credit Note Saga

`apps/api/src/modules/accounting/sagas/credit-note.saga.ts`

```
Steps: Negative stock adjustment → Reversing journal → Complete
```

#### [NEW] Stock Transfer Saga

`apps/api/src/modules/inventory/sagas/stock-transfer.saga.ts`

```
Steps: WH-A OUT → WH-B IN → Movement logs
Compensation: Reverse both movements
```

#### [NEW] Stock Return Saga

`apps/api/src/modules/inventory/sagas/stock-return.saga.ts`

```
Steps: Stock IN → Cost update → Movement log
```

---

## Test Strategy

| Test File                           | Coverage                     |
| ----------------------------------- | ---------------------------- |
| `t021_saga_infrastructure.test.ts`  | PostingContext, SagaLog      |
| `t022_invoice_posting_saga.test.ts` | Invoice saga + compensation  |
| `t023_shipment_saga.test.ts`        | Shipment saga + compensation |
| `t024_goods_receipt_saga.test.ts`   | Receipt saga + compensation  |
| `t025_bill_posting_saga.test.ts`    | Bill saga                    |
| `t026_payment_posting_saga.test.ts` | Payment saga                 |
| `t027_credit_note_saga.test.ts`     | Credit note saga             |
| `t028_stock_transfer_saga.test.ts`  | Transfer saga                |

---

## Verification Plan

```bash
# Run saga tests
npm run test -- --run t021 t022 t023 t024 t025 t026 t027 t028

# Type check
npx tsc --noEmit

# Full build
npm run build
```

---

## Risk Mitigation

| Risk               | Mitigation                                      |
| ------------------ | ----------------------------------------------- |
| Compensation fails | Log COMPENSATION_FAILED, flag for manual review |
| Saga state lost    | SagaLog persisted before each step              |
| Performance impact | Saga overhead minimal (1-2 extra DB writes)     |

---

## Estimated Effort

| Phase             | Tasks                                  | Hours     |
| ----------------- | -------------------------------------- | --------- |
| Infrastructure    | Schema, SagaLog, Context, Orchestrator | 2h        |
| Sales Sagas       | Invoice, Shipment                      | 3h        |
| Procurement Sagas | Goods Receipt, Bill                    | 3h        |
| Accounting Saga   | Payment                                | 1.5h      |
| High Priority     | Credit Note, Transfer, Return          | 3h        |
| Testing           | All saga tests                         | 2h        |
| **Total**         |                                        | **14.5h** |
