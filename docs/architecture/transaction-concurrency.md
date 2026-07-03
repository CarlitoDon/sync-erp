# Transaction & Concurrency

> **Status:** Adopted · **Date:** 2026-07-02
> **Context:** Grilling Session #4 — bagaimana service layer menangani transaksi database dan concurrency.

## Problem

ERP membutuhkan atomicity untuk multi-step operasi (contoh: ship order → update stock → create journal). Tanpa transaksi yang konsisten, bisa terjadi inconsistent state. Juga perlu concurrency control agar operasi yang sama tidak dijalankan ganda.

## Decision — Transaction Propagation via Optional `Prisma.TransactionClient`

Service methods menerima parameter `tx?: Prisma.TransactionClient` yang memungkinkan caller untuk:
- **Inject parent transaction** — semua operasi dalam satu atomic unit
- **Biarkan service buat sendiri** — dengan fallback ke `prisma.$transaction` di dalam method

```ts
async createReturn(
  companyId: string,
  data: { ... },
  tx?: Prisma.TransactionClient   // ← optional propagation
) {
  const db = tx || prisma;        // ← fallback ke default client
  // ... operasi database via db

  if (tx) return execute(tx);     // pakai parent transaction
  return await prisma.$transaction(execute);  // buat sendiri
}
```

### Layer Responsibility

| Layer | Peran |
|---|---|
| **Service method** | Menerima `tx?` — bisa dipanggil standalone atau dalam composable transaction |
| **Caller** | Memilih: pass `tx` dari parent, atau biarkan service manage sendiri |
| **Repository** | Beberapa punya `withTransaction<T>(fn)` wrapper (contoh: `customer-deposit.repository.ts`) |

## Concurrency — Row-Level Locking

Untuk operasi kritis (ship order, create return), service melakukan pessimistic locking:

```ts
// sales-order.service.ts – ship()
await tx.$executeRaw`SELECT 1 FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
```

Ini mencegah race condition — transaksi lain yang mencoba memproses order yang sama akan menunggu sampai transaksi pertama selesai (commit/rollback).

## Error Handling dalam Transaksi

```ts
try {
  return await prisma.$transaction(execute);
} catch (error) {
  if (error instanceof DomainError) throw error;
  const anyError = error as { cause?: unknown };
  if (anyError?.cause instanceof DomainError) throw anyError.cause;
  throw error;
}
```

`DomainError` dari dalam `$transaction` otomatis trigger rollback oleh Prisma.

## Gap Analysis

| ✅ Sudah Ada | ❌ Belum Ada |
|---|---|
| `$transaction` di semua service utama | **Explicit Unit of Work** pattern — transaksi inline di service method |
| Row-level locking (`SELECT FOR UPDATE`) | **Saga pattern** untuk long-running flow multi-service |
| Propagation via `tx` parameter | **Outbox pattern** — event yang gagal setelah commit tidak terkirim |
| `withTransaction()` wrapper di beberapa repository | **Cross-service transaction coordinator** |

### Risiko

1. **Cross-service flow:** Flow yang melibatkan 3+ service (Ship → Invoice → Payment → GL) tidak bisa transaksional karena `tx` propagation terbatas pada call chain yang kebetulan pass `tx`.
2. **Integration setup:** `integration.service.ts` membuat integration + API key. Komen di line 160-165 mengakui bahwa API key creation terjadi di luar transaksi — jika gagal setelah integration commit, state inconsistent.
3. **No outbox:** Event/notification yang harus dikirim setelah transaksi sukses (webhook, email notif) risk drop jika service crash antara commit dan send.

## Rekomendasi

1. **Short-term:** Audit semua flow yang melakukan multi-service writes — pastikan semua operasi dalam satu `$transaction` atau memiliki compensation.
2. **Medium-term:** Implementasi **Transaction Script** class untuk use case kompleks yang perlu multi-service coordination.
3. **Long-term:** Outbox pattern untuk events yang harus reliable (Midtrans notification, webhook, audit log).

## Related

- [Business Shape Routing](./business-shape-routing.md)
- `apps/api/src/modules/**/*.service.ts`
- Pattern: `Prisma.TransactionClient`
