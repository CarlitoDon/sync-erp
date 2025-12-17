# Research: Locking Strategy for Parallel Sagas

**Status**: Decision Made
**Date**: 2025-12-17
**Decision**: Use `SELECT ... FOR UPDATE` with Repository Transaction Injection

## Context

Audit D2 identified that parallel saga executions for the same entity cause data corruption (double-posting). We need a mechanism to serialize these executions.

## Problem

- Sagas execute multiple DB steps using `InvoiceRepository`, `JournalService`, etc.
- Current Repositories use the global `prisma` client (independent connections).
- To use a strict Row Lock (`FOR UPDATE`), the lock and the subsequent updates MUST share the same transaction (and connection).
- If they use different connections, the lock does not protect the update from other transactions.
- Advisory Locks (`pg_advisory_xact_lock`) allow serialization across connections but require 2 connections per Saga (1 for lock, 1 for work), posing a risk of **Connection Pool Exhaustion** (Deadlock) under load.

## Options Considered

### A. Advisory Locks (Session/Transaction level)

- **Pros**: Zero changes to Repository signatures.
- **Cons**:
  - Requires 2 connections per request (1 holding lock, 1 doing work).
  - Risk of pool starvations/deadlocks if concurrency > pool_size/2.
  - Postgres-specific.

### B. Repository Transaction Injection (Chosen)

- **Mechanism**: Update `InvoiceRepository` (and others) to accept an optional `tx: Prisma.TransactionClient`.
  ```typescript
  async update(id: string, data: any, tx?: Prisma.TransactionClient) {
    const db = tx || this.prisma;
    return db.invoice.update(...);
  }
  ```
- **Saga Flow**:
  1. `SagaOrchestrator.execute` starts `prisma.$transaction`.
  2. Acquires Row Lock (`executeRaw` on `tx`).
  3. Passes `tx` to `executeSteps`.
  4. Sagas pass `tx` to Repos.
- **Pros**:
  - Uses strictly 1 connection.
  - Standard SQL locking behavior (`FOR UPDATE`).
  - Safe and atomic.
- **Cons**:
  - Requires refactoring Repositories and Service methods to propagate `tx`.

## Detailed Design

### 1. Repository Pattern Update

All Repositories used in Sagas must accept `tx`.

- `InvoiceRepository`
- `JournalRepository`
- `InventoryService`? (Inventory Service calls policies... might be deep).
  - _Correction_: `InventoryService` might need to accept `tx` too.

### 2. SagaOrchestrator Update

Abstract `executeSteps` will change signature:

```typescript
protected abstract executeSteps(
  input: TInput,
  context: PostingContext,
  tx?: Prisma.TransactionClient // New optional arg
): Promise<TOutput>;
```

### 3. Lock Implementation

In `SagaOrchestrator`:

```typescript
return prisma.$transaction(
  async (tx) => {
    // Acquire exclusive lock on the entity row
    // We need to know the table name. Subclasses can provide it?
    // Or we use a generic lock query if we know the ID and "Entity Context".
    // Simplest: "SELECT 1 FROM \"Invoice\" WHERE id = $1 FOR UPDATE"
    // We can make `getLockQuery(id)` abstract.
    await this.lockEntity(tx, entityId);

    return this.executeSteps(input, context, tx);
  },
  { timeout: 10000 }
); // 10s timeout to prevent indefinite wait
```

## Impact Analysis

- **High Impact**: Requires touching `InvoiceRepository`, `JournalService`, `InventoryService`.
- **Justification**: "Critical" Audit finding requires robust fix. Band-aids (Advisory locks) introduce new stability risks.

## Decision

Proceed with **Option B (Transaction Injection)** for correctness and stability.
