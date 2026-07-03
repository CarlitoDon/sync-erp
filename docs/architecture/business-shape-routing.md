# Business Shape Routing

> **Status:** Adopted · **Date:** 2026-07-02
> **Context:** Grilling Session #3 — bagaimana sistem mendispatch behavior berbeda antar BusinessShape.

## Problem

Sync ERP mendukung multi BusinessShape (RETAIL, MANUFACTURING, SERVICE, RENTAL). Setiap shape punya behavior, validasi, dan fitur yang berbeda. Dibutuhkan mekanisme untuk mendispatch behavior spesifik per shape tanpa mencampurnya di satu blok kode yang brittle.

## Decision

Gunakan **Policy Pattern per module** — file `*.policy.ts` yang berisi method `can*` atau `is*` yang menerima `businessShape` sebagai parameter dan mengembalikan boolean.

```
module/
  policy.ts   ← shape-aware boolean guards
  service.ts  ← business logic, panggil policy
  router.ts   ← tRPC route handler
```

## Mechanism

### Core Pattern — Policy Files

Setiap domain module memiliki policy file yang mengkonsolidasi semua cek shape:

```ts
// inventory.policy.ts
export class InventoryPolicy {
  canTrackByQuantity(shape: BusinessShape): boolean {
    return shape !== BusinessShape.SERVICE;
  }

  canTrackWIP(shape: BusinessShape): boolean {
    return shape === BusinessShape.MANUFACTURING;
  }
}
```

### Runtime Dispatch

1. **Auth middleware** → menyuntikkan `ctx.company.businessShape` ke setiap request (dari DB company record)
2. **Service layer** → memanggil policy methods untuk menentukan behavior:
   ```ts
   if (this.policy.canTrackWIP(company.businessShape)) {
     // WIP tracking logic
   }
   ```
3. **Fallback manual** — beberapa router masih melakukan pengecekan langsung (contoh: `onboarding.router.ts`), direncanakan direfactor ke policy pattern.

## Inventory Policy — Referensi Lengkap

| Method | RETAIL | MANUFACTURING | SERVICE | RENTAL |
|---|---|---|---|---|
| `canTrackByQuantity` | ✅ | ✅ | ❌ | ✅ |
| `canTrackWIP` | ❌ | ✅ | ❌ | ❌ |

## Company Setup — Shape-Dependent Config

`company.service.ts` mendefinisikan feature flags / constraints per shape saat company setup:

| Feature | RETAIL | MANUFACTURING | SERVICE | RENTAL |
|---|---|---|---|---|
| Tax active | configurable | configurable | configurable | configurable |
| Has warehouse | ✅ | ✅ | ❌ | ✅ |
| Can manufacture | ❌ | ✅ | ❌ | ❌ |

## Yang Belum Ideal

- Beberapa router masih pakai `if manual` (contoh: `onboarding.router.ts:348`). Semua harusnya via policy pattern.
- Tidak ada error yang jelas ketika shape tidak terhandle — policy method perlu throw atau default behavior yang eksplisit.

## Rekomendasi ke Depan

1. **Refactor manual checks** di semua router ke policy methods
2. **Exhaustive switch** — gunakan `switch(x) { case: ... default: never }` di policy agar compiler warning kalau ada shape baru tidak terhandle
3. **(Optional)** Jika policy files tumbuh > 5 methods per file, pisahkan ke sub-policy atau strategy class per shape

## Related

- [Dependency Injection](./dependency-injection.md)
- `src/**/policy.ts` di setiap module
- Component: `trpc/context.ts` — inject company profile + shape
