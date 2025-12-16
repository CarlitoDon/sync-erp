# SAGA API Contracts

## Overview

This document defines the internal service contracts for saga orchestration.
No new REST endpoints are exposed - sagas are internal implementation details.

---

## Service Interfaces

### InvoicePostingSaga

```typescript
interface IInvoicePostingSaga {
  /**
   * Execute invoice posting saga
   * @param invoiceId - Invoice to post
   * @param companyId - Company context
   * @returns Posted invoice or throws with compensation done
   */
  execute(invoiceId: string, companyId: string): Promise<Invoice>;

  /**
   * Retry a failed saga
   * @param sagaLogId - ID of failed saga log
   */
  retry(sagaLogId: string): Promise<Invoice>;

  /**
   * Get saga status for an invoice
   */
  getStatus(
    invoiceId: string,
    companyId: string
  ): Promise<SagaLog | null>;
}
```

### BillPostingSaga

```typescript
interface IBillPostingSaga {
  execute(billId: string, companyId: string): Promise<Bill>;
  retry(sagaLogId: string): Promise<Bill>;
  getStatus(
    billId: string,
    companyId: string
  ): Promise<SagaLog | null>;
}
```

### PaymentPostingSaga

```typescript
interface IPaymentPostingSaga {
  execute(paymentId: string, companyId: string): Promise<Payment>;
  retry(sagaLogId: string): Promise<Payment>;
  getStatus(
    paymentId: string,
    companyId: string
  ): Promise<SagaLog | null>;
}
```

---

## PostingContext Interface

```typescript
interface PostingContext {
  readonly id: string; // Saga log ID
  readonly sagaType: SagaType;
  readonly entityId: string;
  readonly companyId: string;

  step: SagaStep;
  stepData: StepData;
  error: string | null;

  // State transitions
  markStockDone(movementId: string): void;
  markBalanceDone(): void;
  markJournalDone(journalId: string): void;
  markCompleted(): void;
  markFailed(error: Error): void;
  markCompensationFailed(error: Error): void;

  // Persistence
  save(): Promise<void>;
}

interface StepData {
  stockMovementId?: string;
  journalId?: string;
  paymentId?: string;
  previousBalance?: number;
}
```

---

## Error Types

```typescript
// Saga failed but was compensated successfully
class SagaCompensatedError extends DomainError {
  constructor(
    public readonly sagaLogId: string,
    public readonly originalError: Error
  ) {
    super(
      `Saga failed and was compensated: ${originalError.message}`
    );
    this.code = 'SAGA_COMPENSATED';
  }
}

// Saga failed AND compensation failed (needs manual)
class SagaCompensationFailedError extends DomainError {
  constructor(
    public readonly sagaLogId: string,
    public readonly originalError: Error,
    public readonly compensationError: Error
  ) {
    super(`Saga compensation failed! Manual intervention required.`);
    this.code = 'SAGA_COMPENSATION_FAILED';
  }
}
```

---

## Events (Future)

For Phase 2 event-driven expansion:

```typescript
interface SagaEvent {
  sagaLogId: string;
  sagaType: SagaType;
  entityId: string;
  companyId: string;
  step: SagaStep;
  timestamp: Date;
}

// Emitted on saga completion
interface SagaCompletedEvent extends SagaEvent {
  type: 'SAGA_COMPLETED';
}

// Emitted on saga failure
interface SagaFailedEvent extends SagaEvent {
  type: 'SAGA_FAILED';
  error: string;
  compensated: boolean;
}
```
