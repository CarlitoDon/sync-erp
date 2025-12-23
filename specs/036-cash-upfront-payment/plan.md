# Implementation Plan: Cash Upfront Payment (Procurement)

**Branch**: `036-cash-upfront-payment` | **Date**: 2025-12-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/036-cash-upfront-payment/spec.md`

## Summary

Implement Cash Upfront Payment for Procurement flow (P2P). This feature enables payment recording before goods receipt, using proper accounting treatment with Prepaid/Advances to Supplier accounts. Key deliverables:

1. **Schema Changes**: Add `paymentTerms` and `paymentStatus` to Order model
2. **Payment Flow**: Register upfront payment (Dr Prepaid, Cr Cash)
3. **Settlement Flow**: Auto-clear Prepaid vs AP when Bill is posted
4. **UI**: Payment modal on PO Detail, Settlement banner on Bill Detail

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 18+  
**Primary Dependencies**: Express, tRPC v11, Prisma ORM, Zod, Decimal.js, React, React Query  
**Storage**: PostgreSQL (via Prisma)  
**Testing**: Integration Tests (MANDATORY), Vitest  
**Target Platform**: Web (Vite + React frontend, Express + tRPC backend)  
**Project Type**: Monorepo (Turborepo)  
**Performance Goals**: Standard ERP response times (<500ms)  
**Constraints**: Multi-tenant isolation by `companyId`  
**Scale/Scope**: 4 new tRPC procedures, 2 new UI modals, 1 schema migration

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **I. Dependency**: Frontend ↔ Backend via tRPC only? Apps → Packages? ✅
- [x] **I. Multi-Tenant**: ALL data isolated by `companyId`? ✅
- [x] **II. Type System**: Shared types in `packages/shared`? Types use `z.infer`? ✅
- [x] **III. Backend Layers**: Service checks `Policy` before Action? (Router → Service → Policy → Repository) ✅
- [x] **III-A. Dumb Layers**: Router only calls service? Repository has no business logic? ✅
- [x] **IV. Frontend**: Logic in `src/features`? UI is State Projection? ✅
- [x] **V. Callback-Safe**: Services export standalone functions? ✅ (using tRPC hooks)
- [x] **VI. Build Verification**: `npx tsc --noEmit` and `npm run build` will pass? ✅
- [x] **VII. Parity**: If Feature A exists in Sales, does it exist in Procurement? ✅ (This is Procurement-only for now, Sales upfront is future scope)
- [x] **VIII. Performance**: No N+1 Client loops? Lists use Backend `include` for relations? ✅
- [x] **IX. Apple-Standard**: Derived from `BusinessShape`? No technical questions to user? ✅
- [x] **X. Data Flow**: Frontend → tRPC → Router → Service → Rules/Policy → Repository → DB? ✅
- [x] **XI. Human Interface**: Clear Navigation? Simplified Workflows? ✅
- [x] **XIII. Engineering**: Zero-Lag UI? Optimistic Updates? ✅
- [x] **XV. Test Contracts**: Mocks satisfy all Policy/Service layer expectations? ✅
- [x] **XVI. Financial Precision**: `Decimal` for money? `Number()` in test assertions? ✅
- [x] **XVII. Integration State**: Sequential flows in single `it()` block? ✅
- [x] **XVIII. Schema for Raw SQL**: `$executeRaw` column names match Prisma schema? ✅
- [x] **XIX. Seed Completeness**: All expected accounts/configs in seed files? ✅ (Account 1600 to be added)
- [x] **XXI. Anti-Bloat**: Reuse existing methods? No redundant method creation? ✅

## Project Structure

### Documentation (this feature)

```text
specs/036-cash-upfront-payment/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── trpc-procedures.md
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
apps/
├── web/                           # Frontend (Vite + React)
│   └── src/
│       ├── features/
│       │   ├── procurement/       # PO Detail page updates
│       │   │   └── components/
│       │   │       └── RegisterPaymentModal.tsx  # NEW
│       │   └── accounting/        # Bill Detail page updates
│       │       └── components/
│       │           └── SettlementModal.tsx       # NEW
│       └── lib/
│           └── trpc.ts            # tRPC client (existing)
│
└── api/                           # Backend (Express + tRPC)
    └── src/
        ├── trpc/routers/
        │   ├── purchaseOrder.router.ts  # Add upfront payment procedures
        │   └── bill.router.ts           # Add settlement procedures
        └── modules/
            ├── procurement/
            │   ├── purchase-order.service.ts   # Add registerUpfrontPayment()
            │   ├── purchase-order.policy.ts    # Add payment validation
            │   └── purchase-order.repository.ts
            └── accounting/
                ├── services/
                │   ├── bill.service.ts         # Add settlement logic
                │   └── journal.service.ts      # Add prepaid journal methods
                ├── policies/
                │   └── bill.policy.ts          # Add settlement validation
                └── repositories/
                    └── payment.repository.ts   # Add PO-linked payments

packages/
├── database/
│   └── prisma/
│       ├── schema.prisma          # Add paymentTerms, paymentStatus enums & fields
│       └── seed.ts                # Add Account 1600 (Advances to Supplier)
│
└── shared/
    └── src/validators/
        ├── order.validators.ts    # Add PaymentTerms, PaymentStatus
        └── payment.validators.ts  # Add UpfrontPaymentInput schema
```

**Structure Decision**: Following existing monorepo structure. New components added within existing feature folders (procurement, accounting). No new modules required.

## Complexity Tracking

| Component               | Complexity | Reason                                            |
| ----------------------- | ---------- | ------------------------------------------------- |
| Schema Migration        | Low        | 2 new enums, 2 new fields on Order                |
| Upfront Payment Service | Medium     | New flow, reuses existing PaymentService patterns |
| Settlement Service      | Medium     | New clearing logic, journal entry orchestration   |
| PO Detail UI            | Low        | Add button + modal, existing patterns             |
| Bill Detail UI          | Medium     | Add banner + modal with calculated amounts        |
| Integration Tests       | Medium     | Full cycle test: PO → Pay → GRN → Bill → Settle   |

**Total Effort Estimate**: ~3-4 days

## Phase 0: Research Summary

### Research Items

| Topic                   | Decision                                    | Rationale                                               |
| ----------------------- | ------------------------------------------- | ------------------------------------------------------- |
| Upfront Payment Account | Use Account 1600 (Advances to Supplier)     | Standard accounting practice; separates prepaid from AP |
| Payment-to-PO Linking   | Add `orderId` field to Payment model        | Direct FK relationship, cleaner than polymorphic        |
| Settlement Trigger      | Manual button on Bill Detail                | Gives user control; auto-settle as future enhancement   |
| Partial Payment         | Supported via remaining balance calculation | Allows multiple payments until PO fully paid            |

### No Unknowns Remaining

All NEEDS CLARIFICATION items from spec have been resolved through research.

## Phase 1: Design Artifacts

### 1. Data Model Changes

See [data-model.md](./data-model.md) for full schema.

**Key Changes**:

```prisma
enum PaymentTerms {
  NET_30
  PARTIAL
  UPFRONT
}

enum PaymentStatus {
  PENDING
  PARTIAL
  PAID_UPFRONT
  SETTLED
}

model Order {
  // ... existing fields
  paymentTerms   PaymentTerms @default(NET_30)
  paymentStatus  PaymentStatus?
  paidAmount     Decimal @default(0)
}

model Payment {
  // ... existing fields
  orderId        String?       // NEW: Link to PO for upfront
  paymentType    String?       // NEW: 'UPFRONT' | 'INVOICE'
  order          Order?        @relation(fields: [orderId], references: [id])
}
```

### 2. API Contracts (tRPC)

See [contracts/trpc-procedures.md](./contracts/trpc-procedures.md) for full contracts.

**Key Procedures**:

| Procedure                              | Method   | Input                                                    | Output                                            |
| -------------------------------------- | -------- | -------------------------------------------------------- | ------------------------------------------------- |
| `purchaseOrder.registerUpfrontPayment` | mutation | `{ orderId, amount, method, bankAccountId, reference? }` | `Payment`                                         |
| `purchaseOrder.getUpfrontPayments`     | query    | `{ orderId }`                                            | `Payment[]`                                       |
| `bill.getPrepaidInfo`                  | query    | `{ billId }`                                             | `{ prepaidAmount, billAmount, settlementAmount }` |
| `bill.settlePrepaid`                   | mutation | `{ billId }`                                             | `Bill`                                            |

### 3. Journal Entry Templates

| Event                    | Debit Account             | Credit Account            | Amount           |
| ------------------------ | ------------------------- | ------------------------- | ---------------- |
| Register Upfront Payment | 1600 Advances to Supplier | 1100 Cash / 1200 Bank     | Payment amount   |
| Post GRN                 | 1400 Inventory            | 2105 GRNI Accrual         | GRN value        |
| Post Bill                | 2105 GRNI Accrual         | 2100 Accounts Payable     | Bill amount      |
| Settle Prepaid           | 2100 Accounts Payable     | 1600 Advances to Supplier | Min(prepaid, AP) |

### 4. Golden Flow Implementation (Constitution XXII)

**Register Upfront Payment Flow**:

```typescript
// 1. PREPARE (Validation & Policy)
const order = await repository.findById(orderId, companyId);
PurchaseOrderPolicy.ensureCanRegisterPayment(order); // Status = POSTED
PurchaseOrderPolicy.ensurePaymentWithinLimit(order, amount); // amount <= remaining

// 2. ORCHESTRATE (Steps)
const paymentData = {
  companyId,
  orderId,
  amount,
  method,
  paymentType: 'UPFRONT',
};
const journalData = { debit: '1600', credit: bankAccountId, amount };

// 3. EXECUTE (Transaction)
return prisma.$transaction(async (tx) => {
  const payment = await paymentRepository.create(paymentData, tx);
  await journalService.postUpfrontPayment(
    companyId,
    payment.id,
    amount,
    method,
    tx
  );
  await repository.updatePaidAmount(orderId, newPaidAmount, tx);
  return payment;
});

// 4. POST-PROCESS (Side Effects)
// None for MVP
```

**Settlement Flow**:

```typescript
// 1. PREPARE
const bill = await billRepository.findById(billId, companyId);
BillPolicy.ensureCanSettle(bill); // Status = POSTED
const prepaid = await paymentRepository.getPrepaidByPO(
  bill.orderId,
  companyId
);
BillPolicy.ensurePrepaidExists(prepaid);

// 2. ORCHESTRATE
const settlementAmount = Math.min(prepaid.amount, bill.balance);

// 3. EXECUTE
return prisma.$transaction(async (tx) => {
  await journalService.postSettlement(
    companyId,
    bill.id,
    settlementAmount,
    tx
  );
  await billRepository.reduceBalance(billId, settlementAmount, tx);
  await paymentRepository.markSettled(prepaid.id, tx);
  return billRepository.findById(billId, companyId, tx);
});
```

## Governance Update (Constitution v3.3.0)

| Principle             | Status        | Notes                                                      |
| --------------------- | ------------- | ---------------------------------------------------------- |
| XXII Golden Flow      | APPLIED       | Both upfront payment and settlement follow 4-stage pattern |
| III-A Thin Router     | APPLIED       | tRPC routers only call service methods                     |
| XIX Seed Completeness | ACTION NEEDED | Add Account 1600 to seed file                              |

> **No Constitution Violations** - All design decisions comply with v3.3.0 principles.

## Next Steps

1. Generate detailed task breakdown: `/speckit-tasks`
2. Key implementation order:
   - Schema migration (paymentTerms, paymentStatus)
   - Seed Account 1600
   - Backend: Payment registration + Journal
   - Backend: Settlement logic
   - Frontend: Payment Modal
   - Frontend: Settlement Banner + Modal
   - Integration Tests
