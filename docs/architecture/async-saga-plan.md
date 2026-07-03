# Async Saga Coordinator — Planning

> **Status:** Draft Plan · **Date:** 2026-07-02
> **Context:** Grilling gap dari Event Bus & Saga (#8). Saat ini saga dieksekusi SYNCHRONOUSLY dalam request lifecycle — risk timeout, server restart, partial failure.

## Problem

Saga saat ini (SagaLog + synchronous execution):

```
Request → SagaLog(PENDING) → stock → balance → journal → SagaLog(COMPLETED)
                                                                  ↑
                                              Semua dalam $transaction dalam HTTP request
```

**Risiko:**
1. **Request timeout** — multi-step saga bisa >30 detik (terutama rental lifecycle)
2. **Server restart** — saga yang setengah jalan hilang (cuma ada SagaLog, tanpa recovery)
3. **No compensation** — `FAILED` dan `COMPENSATION_FAILED` tidak pernah di-trigger
4. **No retry** — gagal di step 3 → manual retry via re-request (tidak ada queue)

## Proposed Architecture: Async Saga Coordinator

```
┌──────────────────────────────────────────────┐
│            Saga Coordinator Service           │
│                                              │
│  1. Enqueue → SagaLog(PENDING) + queue task   │
│  2. Worker dequeue → execute step              │
│  3. Update SagaLog(STEP_DONE)                  │
│  4. Enqueue next step OR complete               │
│  5. On failure → retry (max N) → compensate     │
└──────────────────────────────────────────────┘
```

### Component Options

| Opsi | Mekanisme | Complexity | Durability |
|---|---|---|---|
| **A — BullMQ** | Redis queue, delayed retry, concurrency control | Medium | High (Redis persistence) |
| **B — DB Polling** | SagaLog dengan status + scheduler job | Low | Medium (DB as queue) |
| **C — In-process Queue** | Node.js EventEmitter + in-memory queue | Low | Low (hilang saat restart) |

### Recommended: Option A + B Hybrid

| Event Type | Mekanisme | Contoh |
|---|---|---|
| **Fast saga** (1-2 steps, < 5s) | Synchronous dalam request → skip async | Shipment → Journal |
| **Long saga** (3+ steps, > 5s) | Enqueue via BullMQ → async worker | Rental lifecycle (create → assign → release → settle → invoice) |
| **Fallback** | DB polling sebagai backup kalau Redis down | SagaLog.status = PENDING → cron recovery |

## Saga Step Configuration

```ts
interface SagaDefinition {
  type: SagaType;
  steps: SagaStepConfig[];
  maxRetries: number;
  timeoutMs: number;
  compensatable: boolean; // apakah bisa di-rollback
}

interface SagaStepConfig {
  name: string;           // 'STOCK' | 'BALANCE' | 'JOURNAL'
  execute: (ctx: SagaContext) => Promise<void>;
  compensate?: (ctx: SagaContext) => Promise<void>; // rollback function
  retryDelayMs: number;   // exponential backoff
  timeoutMs: number;
}
```

## Implementation Plan

### Phase 1 — Saga Coordinator Framework (Week 1)

1. **Install BullMQ** — `npm install bullmq ioredis`
2. **Create SagaWorker** — `apps/api/src/saga/saga-worker.ts`
   - Worker loop: dequeue → execute step → update SagaLog → enqueue next step
   - Handle `SagaStep` enum baru (tambah `RETRYING`, `COMPENSATING`)
   - Exponential retry with max attempts
3. **Create SagaClient** — `apps/api/src/saga/saga-client.ts`
   - `SagaClient.enqueue(type, entityId, companyId, payload)` 
   - return `{ sagaId, status: 'PENDING' }`
4. **Update prisma schema** — tambah field di SagaLog:
   ```prisma
   model SagaLog {
     // existing fields...
+    attempts    Int      @default(0)
+    nextRetryAt DateTime?
+    lockedAt    DateTime?
+    lockedBy    String?
+    sagaData    Json?     // full context payload (bukan hanya stepData)
   }
   ```

### Phase 2 — Migrate Existing Sagas (Week 2)

Convert synchronous sagas ke async satu per satu:

| Saga | Priority | Current | Target |
|---|---|---|---|
| `SHIPMENT` | P1 | Sync | Async (3 steps) |
| `GOODS_RECEIPT` | P1 | Sync | Async (2 steps) |
| `INVOICE_POST` | P2 | Sync | Async (2 steps) |
| `STOCK_RETURN` | P2 | Sync | Async (3 steps) |
| `RENTAL_SETTLE` | P3 | Sync | Async (5+ steps) |

### Phase 3 — Compensation (Week 3)

1. Implement `compensate()` untuk setiap saga type
2. `SagaWorker.onFailure()` → trigger compensation chain
3. Update SagaLog ke `COMPENSATED` / `COMPENSATION_FAILED`
4. Alerting untuk `COMPENSATION_FAILED`

### Phase 4 — Dashboard & Monitoring (Week 4)

1. API endpoint: `GET /sagas?status=FAILED`
2. Admin panel: lihat saga status, retry manual, force compensate
3. Metrics: saga duration, failure rate, retry count per type

## Migration Strategy

**Zero-downtime:**
1. Deploy BullMQ + SagaWorker (jalan sebagai background process)
2. Tambah `SagaClient.enqueue()`, old code tetap panggil sync saga
3. Bertahap ganti `ship()` → `await sagaClient.enqueue(SHIPMENT, ...)` 
4. Old sync code dihapus setelah semua consumer migrate

## Cost Estimate

| Resource | Monthly Cost |
|---|---|
| Redis (Upstash / Railway Redis) | ~$5-10 |
| Additional CPU (saga worker) | ~$5 (existing infra) |
| **Total** | **~$10-15/month** |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Redis failure | Saga stuck | DB polling fallback (Phase 2) |
| Worker crash mid-step | Saga stuck halfway | Lock timeout + retry by another worker |
| Compensation failure | Data inconsistent | Alert → manual intervention |
| Queue backpressure | Saga delay | Concurrency limit + monitoring |

## Decision Needed

- **Redis or Railway Redis?** — Upstash (serverless Redis, no infra) vs Railway Redis (same infra)
- **Worker deployment** — As separate process or embedded in API server?
- **Phase 1 priority** — Shipment first (P1) or Rental lifecycle (P3)?
