# Santi Living Integration Analysis

**Document Created**: 2026-01-13  
**Status**: Analysis Complete  
**Related Branches**:

- sync-erp: `feature/santi-living-integration`
- santi-living: `feature/sync-erp-integration`

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SANTI-LIVING                                   │
│                                                                             │
│  ┌─────────────┐     ┌──────────────────┐     ┌─────────────────────────┐   │
│  │   Astro     │────▶│  /api/submit-order│────▶│    erp-sync-service    │   │
│  │  Frontend   │     │    (API Route)   │     │       (port 3002)      │   │
│  │ (port 4321) │     │   [Proxy Layer]  │     └───────────┬────────────┘   │
│  └─────────────┘     └──────────────────┘                 │                │
│        │                                                  │                │
│        │ Checkout Session (localStorage)                  │                │
│        ▼                                                  │                │
│  ┌─────────────┐                                         │                │
│  │  bot-service│◀────────────────────────────────────────┘                │
│  │  (port 3000)│    (WA Notifications via /send-order)                    │
│  │ whatsapp-web│                                                          │
│  └─────────────┘                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ HTTP/tRPC (publicRental.*)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                               SYNC-ERP                                      │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        apps/api (port 3001)                           │  │
│  │  ┌───────────────────────────────────────────────────────────────┐   │  │
│  │  │               public-rental.router.ts                          │   │  │
│  │  │                                                                 │   │  │
│  │  │  publicProcedure (NO AUTH - untuk akses external)              │   │  │
│  │  │  ├── getByToken          → Ambil order via publicToken         │   │  │
│  │  │  ├── findOrCreatePartner → Cari/buat partner by phone          │   │  │
│  │  │  └── createOrder         → Buat rental order (DRAFT)           │   │  │
│  │  └───────────────────────────────────────────────────────────────┘   │  │
│  │                                                                       │  │
│  │  Database (PostgreSQL) → RentalOrder, Partner, RentalBundle, dll     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Key Files Reference

### Santi Living Side

| File                                               | Purpose                                                        |
| -------------------------------------------------- | -------------------------------------------------------------- |
| `src/services/erp-api.ts`                          | Client untuk memanggil erp-sync-service dari frontend          |
| `src/pages/api/submit-order.ts`                    | API proxy - forward request ke erp-sync-service dengan API key |
| `apps/erp-sync-service/src/server.ts`              | Express server - endpoint `/api/orders`                        |
| `apps/erp-sync-service/src/services/erp-client.ts` | tRPC HTTP client ke sync-erp `publicRental.*`                  |
| `apps/erp-sync-service/src/api/create-order.ts`    | Handler: validasi → findOrCreatePartner → createOrder → sendWA |
| `apps/bot-service/src/api/send-order.ts`           | WhatsApp notifikasi ke customer                                |
| `src/pages/sewa-kasur/pesanan/[token].astro`       | Order tracking page (fetch by publicToken)                     |

### Sync ERP Side

| File                                                | Purpose                                                 |
| --------------------------------------------------- | ------------------------------------------------------- |
| `apps/api/src/trpc/routers/public-rental.router.ts` | Public tRPC router (NO AUTH) untuk santi-living         |
| `apps/api/src/trpc/router.ts`                       | Register `publicRentalRouter`                           |
| `packages/database/prisma/schema.prisma`            | `RentalOrder` model dengan field integrasi santi-living |

---

## 3. Data Flow

### 3.1 Order Creation Flow

```
1. Customer isi form di /sewa-kasur → localStorage (checkout-session)
2. Klik "Pesan" → /checkout page
3. Pilih payment method → Submit
4. Frontend call POST /api/submit-order
5. API proxy forward ke erp-sync-service:3002/api/orders
6. erp-sync-service:
   a. Validate input (Zod)
   b. Call sync-erp publicRental.findOrCreatePartner (tRPC)
   c. Call sync-erp publicRental.createOrder (tRPC)
   d. Call bot-service /send-order (WA notification)
   e. Return { orderNumber, publicToken, orderUrl }
7. Redirect ke /sewa-kasur/pesanan/{token}
```

### 3.2 Order Tracking Flow

```
1. Customer buka /sewa-kasur/pesanan/{publicToken}
2. Astro SSR fetch erp-sync-service/api/orders/{token}
3. erp-sync-service call sync-erp publicRental.getByToken
4. Render order status page dengan progress steps
```

---

## 4. Integration Fields (RentalOrder)

Field-field khusus untuk integrasi Santi Living di `RentalOrder` model:

```prisma
// Santi Living Integration Fields (all NULLABLE)
deliveryFee       Decimal?    // Ongkir dari kalkulator
deliveryAddress   String?     // Alamat lengkap display
street            String?     // Jalan
kelurahan         String?
kecamatan         String?
kota              String?
provinsi          String?
zip               String?
latitude          Decimal?
longitude         Decimal?
paymentMethod     String?     // "qris" | "transfer"
discountAmount    Decimal?    // Volume discount
discountLabel     String?     // "Hemat 10%"
orderSource       OrderSource // ADMIN | WEBSITE (enum)
publicToken       String?     // UUID untuk tracking
```

---

## 5. Security Model

| Connection                                  | Auth Method                          |
| ------------------------------------------- | ------------------------------------ |
| santi-living frontend → `/api/submit-order` | None (same origin)                   |
| `/api/submit-order` → erp-sync-service      | Bearer token (`ERP_SYNC_API_KEY`)    |
| erp-sync-service → sync-erp                 | None (public tRPC procedures)        |
| erp-sync-service → bot-service              | Bearer token (`BOT_SERVICE_API_KEY`) |
| Customer tracking page                      | Access via `publicToken` (UUID)      |

---

## 6. Gap Analysis

### 6.1 Customer Flow vs Admin Flow

**Customer Journey (Santi Living):**

```
Order Created → Bayar → "Menunggu Konfirmasi" → ??? → Selesai
```

**Admin Journey (Sync ERP):**

```
DRAFT → CONFIRMED (+ deposit + unit assignment) → ACTIVE (release) → COMPLETED (return)
```

### 6.2 Identified Gaps

| #   | Gap                       | Current State                                     | Impact                                                     | Priority    |
| --- | ------------------------- | ------------------------------------------------- | ---------------------------------------------------------- | ----------- |
| 1   | **Payment Verification**  | Customer klik "Saya Sudah Bayar" tanpa verifikasi | Customer tidak tahu payment diterima atau tidak            | 🔴 Critical |
| 2   | **Payment Status**        | Tidak ada field payment status di order           | Customer bingung apakah sudah bayar                        | 🔴 Critical |
| 3   | **Order Status Gap**      | Order tetap DRAFT setelah customer bayar          | Tidak ada status "PENDING_PAYMENT" atau "PAYMENT_RECEIVED" | 🔴 Critical |
| 4   | **Delivery Status**       | Tidak ada info kapan kasur dikirim                | Customer tidak tahu kapan delivery                         | 🟡 High     |
| 5   | **Admin Notification**    | Tidak ada alert untuk admin                       | Order bisa terlewat                                        | 🟡 High     |
| 6   | **Payment Proof Upload**  | Customer hanya open wa.me (manual)                | Bukti bayar di WhatsApp, bukan sistem                      | 🟢 Medium   |
| 7   | **Auto Payment Matching** | Tidak ada                                         | Semua manual verification                                  | 🟢 Medium   |

### 6.3 Status Flow Mismatch

```
Current RentalOrderStatus enum:
├── DRAFT       ← Order dari website masuk di sini
├── CONFIRMED   ← Admin harus manual confirm + deposit + unit
├── ACTIVE      ← Unit sudah di-release ke customer
├── COMPLETED   ← Return selesai
└── CANCELLED

Missing status for customer payment flow:
├── PENDING_PAYMENT     ← Order dibuat, menunggu bayar
├── AWAITING_CONFIRM    ← Customer claim sudah bayar
└── PAYMENT_CONFIRMED   ← Admin verify pembayaran
```

---

## 7. Recommended Solutions

### 7.1 Priority 1: Payment Status Tracking

Add new enum and fields to schema:

```prisma
enum PaymentStatus {
  PENDING          // Order dibuat, belum bayar
  AWAITING_CONFIRM // Customer klaim sudah bayar
  CONFIRMED        // Admin konfirmasi payment diterima
  FAILED           // Payment rejected/expired
}

model RentalOrder {
  // ... existing fields
  paymentStatus      PaymentStatus @default(PENDING)
  paymentClaimedAt   DateTime?     // Kapan customer klik "Saya Sudah Bayar"
  paymentConfirmedAt DateTime?     // Kapan admin verifikasi
  paymentProofUrl    String?       // URL bukti bayar (opsional)
}
```

### 7.2 Priority 2: Customer Payment Confirmation Endpoint

Add new public procedure:

```typescript
// public-rental.router.ts
confirmPayment: publicProcedure
  .input(
    z.object({
      token: z.string().uuid(),
      paymentMethod: z.enum(['qris', 'transfer']),
      proofUrl: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    // Update paymentStatus = AWAITING_CONFIRM
    // Set paymentClaimedAt = now()
    // Trigger admin notification
  });
```

### 7.3 Priority 3: Admin Notification System

- Webhook/push notification saat order baru dari website
- Dashboard filter "Orders Pending Payment Verification"
- Badge count untuk unconfirmed payments

### 7.4 Priority 4: Customer Status Mapping

```typescript
// Mapping status untuk customer view
const CUSTOMER_STATUS_MAP = {
  // [OrderStatus, PaymentStatus] → Display
  [('DRAFT', 'PENDING')]: 'Menunggu Pembayaran',
  [('DRAFT', 'AWAITING_CONFIRM')]: 'Pembayaran Diproses',
  [('DRAFT', 'CONFIRMED')]: 'Menunggu Konfirmasi Admin',
  [('CONFIRMED', '*')]: 'Pesanan Dikonfirmasi',
  [('ACTIVE', '*')]: 'Sedang Disewa',
  [('COMPLETED', '*')]: 'Selesai',
};
```

---

## 8. Quick Fixes (Without Schema Change)

Temporary workarounds while waiting for schema changes:

### 8.1 Use Notes Field for Payment Claim

```typescript
// Di santi-living saat customer klik "Saya Sudah Bayar"
const updatedNotes = `[PAYMENT_CLAIMED:${new Date().toISOString()}:${paymentMethod}] ${originalNotes}`;
```

### 8.2 Parse Notes in Tracking Page

```typescript
const paymentClaimed = order.notes?.includes('[PAYMENT_CLAIMED:');
const paymentTime = order.notes?.match(
  /\[PAYMENT_CLAIMED:([^\]]+)\]/
)?.[1];
```

### 8.3 Admin Filter

Filter orders yang punya `[PAYMENT_CLAIMED:` tapi masih DRAFT untuk prioritas verifikasi.

---

## 9. Environment Configuration

### Santi Living

```env
# .env
ERP_SYNC_API_KEY=erp_sync_secret_2026
ERP_SYNC_SERVICE_URL=http://localhost:3002
```

### ERP Sync Service

```env
# apps/erp-sync-service/.env
SYNC_ERP_API_URL=http://localhost:3001/api/trpc
BOT_SERVICE_URL=http://localhost:3000
BOT_SERVICE_API_KEY=santi_secret_auth_token_2026
API_KEY=erp_sync_secret_2026
SANTI_LIVING_COMPANY_ID=demo-company-rental
```

---

## 10. Auto-Creation Feature

Sync-erp `publicRental.createOrder` memiliki fitur auto-create bundles/items jika tidak ditemukan:

```typescript
// Jika bundle tidak ditemukan, auto-create dengan metadata dari santi-living
if (!bundle && item.name && item.pricePerDay) {
  bundle = await prisma.rentalBundle.create({
    data: {
      externalId: item.rentalBundleId, // e.g., "package-single-standard"
      name: item.name,
      dailyRate: item.pricePerDay,
      // + auto-create components dari item.components
    },
  });
}
```

Ini memungkinkan santi-living mengirim order tanpa perlu setup katalog dulu di sync-erp.

---

## 11. Action Items

### Immediate (Sprint 1)

- [ ] Add `paymentStatus` enum to schema
- [ ] Add payment-related fields to `RentalOrder`
- [ ] Create `publicRental.confirmPayment` endpoint
- [ ] Update tracking page to show payment status

### Short-term (Sprint 2)

- [ ] Admin notification system for new website orders
- [ ] Dashboard filter for pending payment verification
- [ ] Email/WA notification when order status changes

### Long-term (Backlog)

- [ ] Payment proof upload feature
- [ ] Auto payment matching via bank API
- [ ] Delivery tracking with ETA
- [ ] Customer rating/review after completion

---

## 12. References

- [Rental Business Spec](../specs/043-rental-business/spec.md)
- [Rental Data Model](../specs/043-rental-business/data-model.md)
- [Santi Living Checkout Flow Spec](../../santi-living/specs/003-checkout-payment-flow/spec.md)
