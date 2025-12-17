# Data Model: Transaction Flow

**Feature**: Parallel Saga Safety
**Status**: Draft

## Schema Changes

None. No database schema changes required.

## Logical Data Flow (Locking)

The following sequence describes the new Transactional Locking flow:

1.  **Saga Initiation**:
    - `SagaOrchestrator` starts a `Prisma Interactive Transaction`.
    - **Lock**: Executes `SELECT 1 FROM [Entity] WHERE id = $1 FOR UPDATE`.
    - **Context**: Creates `PostingContext` (Log) - _Note: Logging might happen outside if possible, or inside. Ideally inside to trace the locked attempt._

2.  **Execution (Active Transaction)**:
    - `executeSteps(input, context, tx)` is called.
    - `tx` (Transaction Client) is passed to all Services/Repositories.

3.  **Repository Access**:
    - `Repository.method(..., tx)` checks: `const db = tx || this.prisma`.
    - Uses `db` to execute query.
    - **Result**: Query joins the Active Transaction (Connection 1).

4.  **Completion/Failure**:
    - **Success**: Transaction Commits. Lock released. Changes persisted.
    - **Failure**: Transaction Rollbacks. Lock released. Changes reverted.
    - **Saga Log**:
      - If rollback occurs, we catch error OUTSIDE the transaction loop?
      - If we catch inside, we can't save "Failed" status to DB if we rollback?
      - **Critical**: `SagaLog` must be persisted even on failure.
      - **Refined Flow**:
        - `SagaLog` creation: Outside Transaction (or independent).
        - `Transaction`: Holds lock + Business Logic.
        - `Catch`: If Transaction fails, update `SagaLog` (Outside).

## Entity Updates

### `InvoiceRepository` / `JournalRepository`

- **Method Signature**: All write methods accept `tx?: Prisma.TransactionClient`.

### `SagaOrchestrator`

- **New Method**: `protected abstract getLockTable(): string;` (to know what to lock).
