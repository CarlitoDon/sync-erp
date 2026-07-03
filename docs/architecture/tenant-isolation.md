# Tenant Isolation (Multi-Tenant Data Security)

> **Status:** Adopted · **Date:** 2026-07-02
> **Context:** Grilling Session #6 — bagaimana data antar tenant (company) diisolasi.

## Architecture

Dual-layer isolation: **Application-level** + **Database-level (RLS)**.

### Layer 1 — Application (Auth Middleware)

1. `authMiddleware` membaca `sessionId` dari cookie → verifikasi session
2. Ekstrak `companyId` dari header (`X-Company-Id`)
3. Cek membership via `companyMember.findUnique({ userId_companyId })`
4. Jika bukan member → **403 Forbidden**
5. Jika member → inject `req.context.companyId` + `req.company` (termasuk businessShape)

### Layer 2 — Database (PostgreSQL RLS)

Setelah auth sukses, middleware men-set session variable PostgreSQL:

```ts
// packages/database/src/client.ts
await prisma.$executeRaw`
  SELECT set_config('app.current_company', ${companyId}, false)
`;
```

Kemudian setiap query di-protect oleh RLS policy:

```sql
CREATE POLICY "company_isolation" ON "Order"
  FOR ALL TO authenticated, anon
  USING ("companyId" = current_setting('app.current_company', true)::text);
```

### Helper Functions

```ts
// Executes callback dalam company context (set + unset otomatis)
export async function withCompanyContext<T>(
  companyId: string,
  callback: () => Promise<T>
): Promise<T>

// Set saja tanpa callback — untuk transaction blocks
export async function setCompanyContext(companyId: string): Promise<void>
```

## Coverage — RLS Policy

### Direct companyId column

| Table | Policy |
|---|---|
| `Order` | `companyId = current_setting` |
| `Partner` | same |
| `Product` | same |
| `ProductCategory` | same |
| `RentalOrder` | same |
| `RentalItem` | same |
| `RentalBundle` | same |
| `Fulfillment` | same |
| `Invoice` | same |
| `Payment` | same |
| `Account` | same |
| `JournalEntry` | same |
| `InventoryMovement` | same |
| `Warehouse` | same |
| `BankAccount` | same |
| `ApiKey` | same |

### Via JOIN (no direct companyId column)

| Table | Policy |
|---|---|
| `RentalOrderItem` | EXISTS on `RentalOrder.companyId` |
| `RentalBundleComponent` | EXISTS on `RentalBundle.companyId` |
| `RentalItemUnit` | EXISTS on `RentalItem.companyId` |

### Service Role Bypass

Service role (Supabase internal) bypasses RLS otomatis — digunakan untuk admin/migration operations.

## Session Variable Mechanism

- PostgreSQL `set_config()` dengan scope `false` (session-local, bukan transaction-local)
- Variabel: `app.current_company`
- Format: UUID string
- Diakses via `current_setting('app.current_company', true)` — parameter `true` = return null jika belum diset (tidak throw error)

## Gap Analysis

| ✅ Ada | ❌ Belum Ada |
|---|---|
| RLS di 17+ business tables | RLS di junction tables (OrderItem, InvoiceLine, dsb.) |
| `withCompanyContext()` helper | **Automated RLS test suite** — pastikan data isolation tidak tembus |
| `setCompanyContext()` helper | **Audit log akses** — siapa read company mana |
| App-level membership validation | **Rate limiting per tenant** |
| Supabase migration versioned | **Cross-tenant admin panel** — service role bisa lihat semua tenant |

## Recommendations

1. **RLS test suite** — buat integration test yang menjalankan query tanpa company context (via anon role), pastikan return empty
2. **Junction table audit** — cek apakah OrderItem, InvoiceLine, dan reference tables punya RLS atau perlu JOIN-based policy
3. **Audit log** — catat setiap akses ke company oleh user (walaupun hanya SELECT) untuk security/forensic

## Related

- [Error Boundaries](./error-boundaries.md)
- `packages/database/src/client.ts` — denganCompanyContext, setCompanyContext
- `apps/api/src/middlewares/auth.ts` — session validation, company membership check
- `supabase/migrations/20260115_enable_rls.sql` — RLS policy definitions
