# Event Bus, Saga, & Outbox Pattern

> **Status:** Adopted · **Date:** 2026-07-02
> **Context:** Grilling Session #8 — bagaimana komunikasi antar-module, eventual consistency, dan reliable event delivery.

## Architecture

Tidak ada event bus/pub-sub universal. Komunikasi antar-module menggunakan **Saga pattern** + **Poll-based Outbox**.

## 1. Saga Pattern

Sync ERP memiliki saga coordinator yang di-track via `SagaLog` table.

### Skema

```prisma
model SagaLog {
  id            String   @id @default(uuid())
  sagaType      SagaType   // jenis saga
  entityId      String     // business entity reference
  companyId     String     // tenant scope
  step          SagaStep   // current step progress
  stepData      Json?
  error         String?
  correlationId String?
  createdAt     DateTime
  updatedAt     DateTime   @updatedAt
}
```

### Saga Types

| SagaType | Flow |
|---|---|
| `INVOICE_POST` | Post → Journal → GL |
| `SHIPMENT` | Validate stock → Create shipment → Update order → Journal |
| `GOODS_RECEIPT` | Receive → Update inventory → Journal |
| `BILL_POST` | Validate → Post → Journal |
| `PAYMENT_POST` | Validate → Record → Journal |
| `CREDIT_NOTE` | Create credit → Reverse inventory → Journal |
| `STOCK_TRANSFER` | Out warehouse → In warehouse → Balance |
| `STOCK_RETURN` | Return → Restock → Journal |

### Saga Steps

| Step | Arti |
|---|---|
| `PENDING` | Saga baru dimulai |
| `STOCK_DONE` | Inventory movement completed |
| `BALANCE_DONE` | Balance update completed |
| `JOURNAL_DONE` | Accounting journal posted |
| `COMPLETED` | Saga selesai |
| `FAILED` | Saga gagal |
| `COMPENSATION_FAILED` | Rollback juga gagal |

### Flow Typical

```
recordAudit()                     ← FR-010.1: catat intent sebelum eksekusi
  → SagaLog.create(PENDING)
    → Execute Step 1 (STOCK)
    → Update SagaLog(STOCK_DONE)
    → Execute Step 2 (BALANCE)
    → Update SagaLog(BALANCE_DONE)
    → Execute Step 3 (JOURNAL)
    → Update SagaLog(COMPLETED)
```

## 2. Webhook Outbox Pattern

Untuk event yang perlu dikirim ke eksternal (tenant webhooks), sistem menggunakan **outbox table** + **polling**.

### Dual Outbox System

| Outbox | Tujuan |
|---|---|
| `TenantWebhookOutbox` | External webhook ke tenant API endpoints |
| `RentalWebhookOutbox` | Rental-spesifik webhook delivery |

### Outbox Schema

```prisma
model TenantWebhookOutbox {
  id            String
  companyId     String
  event         String                    // event name
  payload       Json
  status        TenantWebhookOutboxStatus // PENDING → PROCESSING → DELIVERED / FAILED / DEAD_LETTER
  attempts     Int          @default(0)
  lastError    String?
  lastAttemptAt DateTime?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
}
```

### Delivery Flow

```
Service → enqueueDelivery({ event, payload })
  → TenantWebhookOutbox.create(status=PENDING)
    ↓
Polling worker (TenantWebhookOutboxService)
  → fetch PENDING records
  → mark PROCESSING
  → HTTP POST ke webhook URL
  → DELIVERED | FAILED | DEAD_LETTER (max 3 attempts)
```

### Fitur Outbox

- **HMAC-SHA256 signature** — setiap payload ditandatangani untuk verifikasi tenant
- **Retry dengan exponential backoff** — base 500ms, max 5s, max 3 attempts
- **Dead letter threshold** — warning di 20 failed entries
- **Timeout config** — `WEBHOOK_TIMEOUT_MS`
- **Retryable status codes** — hanya status tertentu yang di-retry (5xx, timeout)

## 3. Saga Orchestrator

Berbeda dengan outbox (polling-based), saga dieksekusi synchronously dalam request lifecycle:

```ts
// Contoh flow ship → saga
async ship(companyId, orderId) {
  // 1. recordAudit BEFORE execution (FR-010.1)
  await recordAudit({ action: 'SHIPMENT_CREATED', ... });

  // 2. Buat SagaLog entry
  const saga = await sagaLogRepo.create({ sagaType: SHIPMENT, step: PENDING });

  try {
    // 3. Execute dalam transaksi
    await prisma.$transaction(async (tx) => {
      await lockOrder(orderId);
      const shipment = await createShipment(orderId, tx);
      await updateInventory(shipment.items, tx);
      await createJournal(shipment, tx);
    });

    // 4. Update saga progress
    await sagaLogRepo.update(saga.id, { step: COMPLETED });
  } catch (e) {
    await sagaLogRepo.update(saga.id, {
      step: FAILED, error: e.message
    });
    throw e;
  }
}
```

## Gap Analysis

| ✅ Ada | ❌ Belum Ada |
|---|---|
| SagaLog + SagaType enum | **Event bus** — tidak ada pub/sub antar service dalam process |
| Outbox for webhook delivery (2x) | **Transactional outbox** — outbox record dibuat di EXTERNAL transaction, tidak dalam transaksi bisnis (risk: event terkirim tanpa state commit, atau state commit tanpa event) |
| HMAC signature untuk tenant webhook | **Event catalog** — satu tempat yang mendaftar semua events + payload shape |
| Retry + dead letter | **Async saga coordinator** — saga saat ini synchronous dalam request lifecycle |
| SagaStep progress tracking | **Cross-module events** — rental return → perlu update inventory → perlu journal: saat ini inline call, bukan event-driven |
| Correlation ID tracing | **DLQ UI** — dead letter hanya bisa diinspeksi via DB |
| Webhook timeout + config |  |

## Recommendations

1. **Transactional outbox** — buat outbox record dalam `$transaction` yang sama dengan business operation. Jika transaksi rollback, outbox juga rollback. Jika commit, polling worker ambil.
2. **Async saga** — untuk long-running flow (rental lifecycle multi-tahap), pertimbangkan saga coordinator asynchronous yang bisa survive server restart.
3. **Internal event bus** — jika cross-module coupling makin tinggi, adopsi lightweight event bus (Node.js EventEmitter atau BullMQ) untuk decouple modul.
4. **Event catalog** — satu file `docs/architecture/events.md` yang mendaftar semua events: nama, payload shape, producer, consumer, guarantee level.

## Related

- [Audit Trail](./audit-trail.md) — FR-010.1: record BEFORE saga
- [Transaction & Concurrency](./transaction-concurrency.md)
- `apps/api/src/services/tenant-webhook-outbox.service.ts`
- `apps/api/src/services/webhook.service.ts`
- `packages/database/prisma/schema.prisma` (model SagaLog, TenantWebhookOutbox, RentalWebhookOutbox)
