# Data Model: E2E Business Flows

## Entity Changes

### 1. AuditLog (NEW)

Business-level historical record for accountability and compliance.

| Field             | Type       | Description                                           |
| ----------------- | ---------- | ----------------------------------------------------- |
| `companyId`       | `String`   | Multi-tenant isolation.                               |
| `actorId`         | `String`   | User who initiated the action.                        |
| `action`          | `String`   | Business action (e.g., `INVOICE_POSTED`).             |
| `entityType`      | `String`   | Type of entity affected (e.g., `INVOICE`).            |
| `entityId`        | `String`   | ID of the primary entity.                             |
| `businessDate`    | `DateTime` | The date the transaction is recognized in the ledger. |
| `correlationId`   | `String`   | Links audit record to technical saga steps.           |
| `payloadSnapshot` | `Json`     | The original command payload for reconstructability.  |

### 2. SagaLog (Technical Execution)

Control-plane trace for execution state and recovery.

| Field           | Type     | Description                                           |
| --------------- | -------- | ----------------------------------------------------- |
| `sagaType`      | `Enum`   | Type of Saga (e.g., `InvoicePostingSaga`).            |
| `entityId`      | `String` | Target entity ID.                                     |
| `step`          | `Enum`   | Current execution step.                               |
| `status`        | `Enum`   | `STARTED`, `COMPLETED`, `FAILED`, `COMPENSATED`, etc. |
| `stepData`      | `Json`   | Data specific to the current step (for compensation). |
| `error`         | `String` | Error message if failed.                              |
| `correlationId` | `String` | Links technical steps to the business audit log.      |

### 3. IdempotencyKey (Usage Clarification)

- Existing model `IdempotencyKey` with `(companyId, scope, entityId)` is sufficient for DB-level deduplication.
- **Relationship to correlationId**: `correlationId` is used for request tracing (Audit/Saga linking), while `IdempotencyKey` prevents duplicate DB writes.
- Enforce usage in `InvoicePost` and `PaymentCreate` scopes via T012/T017.

## Proposed Prisma Schema (Pending Implementation)

```prisma
model SagaLog {
  id            String   @id @default(uuid())
  sagaType      SagaType
  entityId      String
  companyId     String
  step          SagaStep
  stepData      Json?
  error         String?
  correlationId String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([entityId])
  @@index([companyId, sagaType, step])
  @@index([correlationId])
}

model AuditLog {
  id              String   @id @default(uuid())
  companyId       String
  actorId         String
  action          String
  entityType      String
  entityId        String
  businessDate    DateTime
  payloadSnapshot Json?
  correlationId   String?
  createdAt       DateTime @default(now())

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId, action])
  @@index([entityId])
  @@index([businessDate])
  @@index([correlationId])
}
```

## State Transitions

### Sales Order (O2C)

`DRAFT` → `CONFIRMED` → `COMPLETED`

### Purchase Order (P2P)

`DRAFT` → `CONFIRMED` → `RECEIVED`

### Invoice / Bill

`DRAFT` (Mutable) → `POSTED` (Immutable) → `PAID` (Balance = 0)
