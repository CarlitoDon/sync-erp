# Integration & SaaS Readiness Report — Sync ERP

**Date**: 2026-01-13  
**Scope**: Wide scan of `apps/api`, `apps/web`, `apps/bot`, `packages/database`, `deploy/`, and `docs/` for tight coupling to Santi Living and SaaS readiness gaps.  
**Branch**: `cto/integration-saas-readiness-report`

---

## 1. Executive Summary

Sync ERP currently has deep, multi-layer tight coupling to the **Santi Living** tenant. Hardcoded strings, Santi-specific API endpoints, product categories, webhook schemas, and seed data are spread across the database layer, service layer, router layer, webhook system, frontend, and bot service. This makes the platform impossible to onboard a second rental tenant (e.g., Rockhouse, POS Lite) without forking code or risking cross-tenant data leakage.

This report documents every finding with **exact file paths and line numbers**, then proposes a **6-phase architectural roadmap** to transform Sync ERP into a SaaS-ready platform with a plugin-based integration layer.

---

## 2. Hasil Wide Scan — Semua Temuan Tight Coupling Santi Living

### 2.1 Database Layer (Prisma Schema)

| File                                     | Line                    | Finding                                                                              | Severity |
| ---------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------ | -------- |
| `packages/database/prisma/schema.prisma` | 202                     | `appId` comment example: `"santi-living"`                                            | Low      |
| `packages/database/prisma/schema.prisma` | 203                     | `name` comment example: `"Santi Living"`                                             | Low      |
| `packages/database/prisma/schema.prisma` | 226                     | `name` comment example: `"Santi Living Production"`                                  | Low      |
| `packages/database/prisma/schema.prisma` | 974                     | `externalId` comment: `// santi-living package ID (e.g., "package-single-standard")` | Medium   |
| `packages/database/prisma/schema.prisma` | 1067                    | Block comment `// Santi Living Integration Fields` on `RentalOrder`                  | High     |
| `deploy/api-mcp/prisma/schema.prisma`    | 202-203, 226, 974, 1067 | Same hardcoded comments duplicated in deploy schema                                  | High     |

**Code Snippet — `packages/database/prisma/schema.prisma:1067-1080`**

```prisma
// Santi Living Integration Fields
  deliveryFee     Decimal?    @db.Decimal(15, 2)
  deliveryAddress String?     @db.Text // Full combined address for display
  street          String? // Jalan/nama jalan
  kelurahan       String?
  kecamatan       String?
  kota            String? // Kabupaten/Kota
  provinsi        String?
  zip             String? // Kode pos
  latitude        Decimal?    @db.Decimal(10, 8)
  longitude       Decimal?    @db.Decimal(11, 8)
  paymentMethod   String? // "qris" | "transfer"
```

> **Impact**: These fields are treated as Santi-specific, but they are actually generic e-commerce/delivery fields. The comment anchors them mentally to one tenant.

---

### 2.2 Service Layer

#### 2.2.1 `integration.service.ts` — Hardcoded Integration Catalog

| File                                           | Line  | Finding                                                                                   |
| ---------------------------------------------- | ----- | ----------------------------------------------------------------------------------------- |
| `apps/api/src/services/integration.service.ts` | 30    | `appId: 'santi-living'`                                                                   |
| `apps/api/src/services/integration.service.ts` | 31    | `name: 'Santi Living'`                                                                    |
| `apps/api/src/services/integration.service.ts` | 33    | `description: 'Rental management and WhatsApp bot integration for Santi Living.'`         |
| `apps/api/src/services/integration.service.ts` | 38-41 | `defaultConfig.paths` hardcoded to Santi URL patterns: `/api/orders/{token}/notify-admin` |

**Code Snippet — `apps/api/src/services/integration.service.ts:28-43`**

```typescript
export const AVAILABLE_INTEGRATIONS: IntegrationApp[] = [
  {
    appId: 'santi-living',
    name: 'Santi Living',
    description:
      'Rental management and WhatsApp bot integration for Santi Living.',
    icon: 'CubeIcon',
    defaultConfig: {
      webhookUrl: '',
      syncEnabled: true,
      paths: {
        newOrder: '/api/orders/{token}/notify-admin',
        paymentStatus: '/api/orders/{token}/notify-payment',
      },
    },
  },
```

> **Impact**: The "marketplace" only knows Santi Living. Adding a new tenant requires editing source code and redeploying the API.

#### 2.2.2 `rental-bundle.service.ts` — Santi-Specific Sync Function

| File                                                   | Line | Finding                              |
| ------------------------------------------------------ | ---- | ------------------------------------ |
| `apps/api/src/modules/rental/rental-bundle.service.ts` | 154  | Comment `// Sync from Santi Living`  |
| `apps/api/src/modules/rental/rental-bundle.service.ts` | 169  | Interface `SyncFromSantiLivingInput` |
| `apps/api/src/modules/rental/rental-bundle.service.ts` | 174  | Function `syncFromSantiLiving(...)`  |

**Code Snippet — `apps/api/src/modules/rental/rental-bundle.service.ts:169-176`**

```typescript
export interface SyncFromSantiLivingInput {
  companyId: string;
  bundles: SyncBundleItem[];
}

export async function syncFromSantiLiving(
  input: SyncFromSantiLivingInput
) {
```

> **Impact**: The sync logic assumes Santi's product structure (`includes: string[]` with Indonesian item names like `"2 bantal"`). Another tenant with different component semantics cannot reuse this.

#### 2.2.3 `rental-external-order.service.ts` — Hardcoded `createdBy`

| File                                                           | Line | Finding                             |
| -------------------------------------------------------------- | ---- | ----------------------------------- |
| `apps/api/src/modules/rental/rental-external-order.service.ts` | 196  | `createdBy: 'santi-living-website'` |

**Code Snippet — `apps/api/src/modules/rental/rental-external-order.service.ts:194-197`**

```typescript
        notes: input.notes,
        createdBy: 'santi-living-website',
        deliveryFee: input.deliveryFee,
```

> **Impact**: All external orders are stamped as coming from Santi Living, making it impossible to distinguish which integration actually created the order.

#### 2.2.4 `rental-external-order.service.ts` — Hardcoded SKU Prefix

| File                                                           | Line | Finding                             |
| -------------------------------------------------------------- | ---- | ----------------------------------- |
| `apps/api/src/modules/rental/rental-external-order.service.ts` | 1057 | `toExternalSku` returns `SL-${...}` |

**Code Snippet — `apps/api/src/modules/rental/rental-external-order.service.ts:1057-1059`**

```typescript
  private toExternalSku(value: string) {
    return `SL-${value.toLowerCase().replace(/\s+/g, '-')}`;
  }
```

> **Impact**: "SL" stands for Santi Living. Auto-created products leak this prefix into the catalog of every tenant.

#### 2.2.5 `rental-webhook-outbox.service.ts` — Santi-Specific Path Defaults

| File                                                           | Line | Finding                                                     |
| -------------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| `apps/api/src/modules/rental/rental-webhook-outbox.service.ts` | 784  | Default path `'/api/orders/{token}/notify-admin'` hardcoded |

**Code Snippet — `apps/api/src/modules/rental/rental-webhook-outbox.service.ts:781-784`**

```typescript
const pathTemplate =
  typeof pathsConfig.newOrder === 'string'
    ? pathsConfig.newOrder
    : '/api/orders/{token}/notify-admin';
```

---

### 2.3 Router Layer (tRPC)

#### 2.3.1 `router.ts` — Santi Comment on `publicRental`

| File                          | Line | Finding                                                                                            |
| ----------------------------- | ---- | -------------------------------------------------------------------------------------------------- |
| `apps/api/src/trpc/router.ts` | 23   | `import { publicRentalRouter } from './routers/public-rental.router'; // Santi Living Integration` |
| `apps/api/src/trpc/router.ts` | 36   | `publicRental: publicRentalRouter, // External client access (santi-living)`                       |

**Code Snippet — `apps/api/src/trpc/router.ts:23,36`**

```typescript
import { publicRentalRouter } from './routers/public-rental.router'; // Santi Living Integration
...
  publicRental: publicRentalRouter, // External client access (santi-living)
```

#### 2.3.2 `public-rental.router.ts` — Santi Comment in Header

| File                                                | Line | Finding                                                                      |
| --------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `apps/api/src/trpc/routers/public-rental.router.ts` | 5    | `* This router is used by external clients (santi-living erp-sync-service).` |

**Code Snippet — `apps/api/src/trpc/routers/public-rental.router.ts:1-7`**

```typescript
/**
 * Public Rental Router (Facade)
 *
 * Composes sub-routers for partner, order, and payment management.
 * This router is used by external clients (santi-living erp-sync-service).
 *
```

#### 2.3.3 `public-rental-order.router.ts` — Multiple Santi References

| File                                                                    | Line | Finding                                                                                  |
| ----------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------- |
| `apps/api/src/trpc/routers/public-rental/public-rental-order.router.ts` | 47   | `// Santi Living address fields`                                                         |
| `apps/api/src/trpc/routers/public-rental/public-rental-order.router.ts` | 125  | `* Auto-creates bundles/items if not found (for santi-living integration)`               |
| `apps/api/src/trpc/routers/public-rental/public-rental-order.router.ts` | 140  | `// Metadata for auto-creation (from santi-living)`                                      |
| `apps/api/src/trpc/routers/public-rental/public-rental-order.router.ts` | 159  | `// Santi Living integration fields`                                                     |
| `apps/api/src/trpc/routers/public-rental/public-rental-order.router.ts` | 211  | `* Used by santi-living "Edit Pesanan" flow to update customer info, items, dates, etc.` |
| `apps/api/src/trpc/routers/public-rental/public-rental-order.router.ts` | 286  | `* Used by santi-living to rollback invalid orders`                                      |

#### 2.3.4 `public-rental-partner.router.ts` — Santi Reference

| File                                                                      | Line | Finding                                         |
| ------------------------------------------------------------------------- | ---- | ----------------------------------------------- |
| `apps/api/src/trpc/routers/public-rental/public-rental-partner.router.ts` | 16   | `* Used when creating orders from santi-living` |

#### 2.3.5 `public-rental-payment.router.ts` — Santi Reference

| File                                                                      | Line | Finding                                                                             |
| ------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------- |
| `apps/api/src/trpc/routers/public-rental/public-rental-payment.router.ts` | 21   | `// Lazy resolve webhook service (for admin notifications - Santi Living specific)` |

#### 2.3.6 `rental-bundle.router.ts` — Santi-Specific Procedures

| File                                                | Line | Finding                                                 |
| --------------------------------------------------- | ---- | ------------------------------------------------------- |
| `apps/api/src/trpc/routers/rental-bundle.router.ts` | 87   | `// Find by external ID (for santi-living integration)` |
| `apps/api/src/trpc/routers/rental-bundle.router.ts` | 99   | `// Sync bundles from santi-living products.json`       |
| `apps/api/src/trpc/routers/rental-bundle.router.ts` | 100  | `syncFromSantiLiving: publicProcedure`                  |
| `apps/api/src/trpc/routers/rental-bundle.router.ts` | 120  | `return bundleService.syncFromSantiLiving(input);`      |

#### 2.3.7 `integration.router.ts` — Default Permissions Locked to Rental

| File                                              | Line | Finding                                        |
| ------------------------------------------------- | ---- | ---------------------------------------------- |
| `apps/api/src/trpc/routers/integration.router.ts` | 36   | `permissions: ['rental:read', 'rental:write']` |
| `apps/api/src/trpc/routers/integration.router.ts` | 78   | `permissions: ['rental:read', 'rental:write']` |
| `apps/api/src/trpc/routers/integration.router.ts` | 144  | `permissions: ['rental:read', 'rental:write']` |

> **Impact**: Every new integration gets rental permissions by default, regardless of business shape. A POS Lite integration would get rental webhooks.

---

### 2.4 Webhook System

#### 2.4.1 `rental-webhook.service.ts` — Hardcoded Event Types

The webhook service only knows three event types: `notifyPaymentStatus`, `notifyNewOrder`, `notifyOrderCreated`, `notifyOrderCancelled`. These are Santi-specific admin notifications. There is no generic event catalog.

#### 2.4.2 `rental-webhook-outbox.service.ts` — Hardcoded Delivery Types

| File                                                           | Line    | Finding                                                                  |
| -------------------------------------------------------------- | ------- | ------------------------------------------------------------------------ |
| `apps/api/src/modules/rental/rental-webhook-outbox.service.ts` | 101-118 | `enqueueNewOrder` hardcodes `RentalWebhookDeliveryType.NEW_ORDER`        |
| `apps/api/src/modules/rental/rental-webhook-outbox.service.ts` | 756-802 | `buildNewOrderRequest` hardcodes `action: 'new_order'` and payload shape |

**Code Snippet — `apps/api/src/modules/rental/rental-webhook-outbox.service.ts:794-800`**

```typescript
      body: {
        action: 'new_order',
        orderNumber,
        customerName,
        customerPhone,
        totalAmount,
      },
```

> **Impact**: Payload schema is locked to Santi's expected body. Another tenant expecting `order_number` (snake_case) or extra fields cannot be supported.

---

### 2.5 Product Categories & Frontend

#### 2.5.1 `public-rental-order.router.ts` — Hardcoded Categories

| File                                                                    | Line    | Finding                                                  |
| ----------------------------------------------------------------------- | ------- | -------------------------------------------------------- |
| `apps/api/src/trpc/routers/public-rental/public-rental-order.router.ts` | 143-145 | `category: z.enum(['package', 'mattress', 'accessory'])` |

> **Impact**: These categories are mattress-rental specific. A car-rental tenant would have `['sedan', 'suv', 'van']`.

#### 2.5.2 `RentalBundlesPage.tsx` — Santi-Specific Frontend

| File                                                       | Line    | Finding                                                                    |
| ---------------------------------------------------------- | ------- | -------------------------------------------------------------------------- |
| `apps/web/src/features/rental/pages/RentalBundlesPage.tsx` | 15      | `import { formatCurrency, getSantiLivingAssetUrl } from '@/utils/format';` |
| `apps/web/src/features/rental/pages/RentalBundlesPage.tsx` | 39      | `trpc.rentalBundle.syncFromSantiLiving.useMutation(...)`                   |
| `apps/web/src/features/rental/pages/RentalBundlesPage.tsx` | 58      | `// Hardcoded bundle data from santi-living for sync`                      |
| `apps/web/src/features/rental/pages/RentalBundlesPage.tsx` | 63      | `message: 'Sinkronisasi bundle dari master data Santi Living?'`            |
| `apps/web/src/features/rental/pages/RentalBundlesPage.tsx` | 150     | `Sync dari Santi Living`                                                   |
| `apps/web/src/features/rental/pages/RentalBundlesPage.tsx` | 164     | `src={getSantiLivingAssetUrl(bundle.imagePath)}`                           |
| `apps/web/src/features/rental/pages/RentalBundlesPage.tsx` | 257-258 | `Silakan sinkronisasi bundle dari master data Santi Living.`               |

#### 2.5.3 `format.ts` — Hardcoded Santi Asset URL

| File                           | Line | Finding                                      |
| ------------------------------ | ---- | -------------------------------------------- |
| `apps/web/src/utils/format.ts` | 30   | `* Get Santi Living asset URL (images, etc)` |
| `apps/web/src/utils/format.ts` | 34   | `export const getSantiLivingAssetUrl`        |
| `apps/web/src/utils/format.ts` | 45   | `: 'https://santiliving.com';`               |

**Code Snippet — `apps/web/src/utils/format.ts:30-45`**

```typescript
/**
 * Get Santi Living asset URL (images, etc)
 * In development: uses localhost:4321 (Astro dev server)
 * In production: uses santiliving.com
 */
export const getSantiLivingAssetUrl = (path: string): string => {
  if (!path) return '';

  // If already a full URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const isDev = import.meta.env.DEV;
  const baseUrl = isDev
    ? 'http://localhost:4321'
    : 'https://santiliving.com';
```

#### 2.5.4 `RentalOrderDetail.tsx` & `RentalOrdersPage.tsx` — Santi Tooltip

| File                                                       | Line | Finding                           |
| ---------------------------------------------------------- | ---- | --------------------------------- |
| `apps/web/src/features/rental/pages/RentalOrderDetail.tsx` | 117  | `title="Order dari Santi Living"` |
| `apps/web/src/features/rental/pages/RentalOrdersPage.tsx`  | 318  | `title="Order dari Santi Living"` |

---

### 2.6 Seed Data & Environment

#### 2.6.1 `seed.ts` — Hardcoded Santi Integration & Keys

| File                               | Line | Finding                                                              |
| ---------------------------------- | ---- | -------------------------------------------------------------------- |
| `packages/database/prisma/seed.ts` | 555  | `const appId = 'santi-living';`                                      |
| `packages/database/prisma/seed.ts` | 564  | `name: 'Santi Living',`                                              |
| `packages/database/prisma/seed.ts` | 565  | `description: 'Official Santi Living Integration',`                  |
| `packages/database/prisma/seed.ts` | 571  | `: 'https://proxy.santiliving.com/api/webhooks/order-confirmation',` |
| `packages/database/prisma/seed.ts` | 579  | `: 'santi_secret_auth_token_2026',`                                  |
| `packages/database/prisma/seed.ts` | 591  | `? 'Santi Living Development'`                                       |
| `packages/database/prisma/seed.ts` | 592  | `: 'Santi Living Production',`                                       |
| `packages/database/prisma/seed.ts` | 602  | `? 'Santi Living Development'`                                       |
| `packages/database/prisma/seed.ts` | 603  | `: 'Santi Living Production',`                                       |

#### 2.6.2 `bot/src/server.ts` — Hardcoded Service Name

| File                     | Line | Finding                        |
| ------------------------ | ---- | ------------------------------ |
| `apps/bot/src/server.ts` | 29   | `service: 'santi-living-bot',` |

#### 2.6.3 `bot/src/utils/formatter.ts` — Hardcoded Brand Name

| File                              | Line | Finding                                                                               |
| --------------------------------- | ---- | ------------------------------------------------------------------------------------- |
| `apps/bot/src/utils/formatter.ts` | 22   | `message += \`Terima kasih sudah memesan di _Sewa Kasur Jogja by Santi Mebel_.\\n\`;` |

---

### 2.7 Test Layer

| File                                                                          | Line | Finding                                                            |
| ----------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `apps/api/test/e2e/santi-living-live-order-flow.test.ts`                      | 24   | `const COMPANY_ID = 'test-santi-living-live-e2e-001';`             |
| `apps/api/test/e2e/santi-living-live-order-flow.test.ts`                      | 84   | `'santi-living/apps/proxy/src/server.ts'`                          |
| `apps/api/test/e2e/santi-living-live-order-flow.test.ts`                      | 88   | `'santi-living/apps/web/src/lib/trpc-client.ts'`                   |
| `apps/api/test/e2e/santi-living-live-order-flow.test.ts`                      | 436  | `describe.skipIf(...)('Santi Living live order flow E2E', () => {` |
| `apps/api/test/integration/rental/rental-webhook-outbox.admin-router.test.ts` | 43   | `where: { companyId, appId: 'santi-living' },`                     |
| `apps/api/test/integration/rental/rental-webhook-outbox.admin-router.test.ts` | 57   | `appId: 'santi-living',`                                           |
| `apps/api/test/integration/rental/rental-webhook-outbox.admin-router.test.ts` | 62   | `newOrder: '/api/orders/{token}/notify-admin',`                    |

---

## 3. Rekomendasi Arsitektur — 6 Phase Perubahan

### Phase 1: Decouple Domain Model

**Goal**: Remove Santi-specific comments and make `RentalOrder` fields generic.

- Rename `// Santi Living Integration Fields` → `// External Order Fields (e-commerce / delivery)`
- Make `createdBy` an enum or foreign key: `createdBy: 'WEBSITE' | 'API' | 'ADMIN'` instead of a hardcoded string.
- Extract `externalId` semantics: add `IntegrationOrder` junction table linking `RentalOrder` → `Integration` + `externalOrderId`.
- Add `tenantBrandName` to `Company` so the bot can format messages dynamically.

```prisma
model IntegrationOrder {
  id            String      @id @default(cuid())
  rentalOrderId String
  integrationId String
  externalId    String?     // Tenant's own order ID
  createdAt     DateTime    @default(now())

  rentalOrder   RentalOrder @relation(fields: [rentalOrderId], references: [id])
  integration   Integration @relation(fields: [integrationId], references: [id])

  @@unique([rentalOrderId, integrationId])
}
```

---

### Phase 2: Rebuild Integration Layer sebagai Plugin System

**Goal**: Stop hardcoding `AVAILABLE_INTEGRATIONS`. Integrations self-register via manifest.

**Folder Structure**:

```
apps/api/src/integrations/
├── registry.ts              # Plugin loader & validator
├── manifest.schema.ts       # Zod schema for integration manifest
├── types.ts                 # Shared interfaces
├── base-integration.ts      # Abstract base class
├── santi-living/
│   ├── manifest.json
│   ├── index.ts             # Plugin entry point
│   ├── router.ts            # Santi-specific public routes
│   ├── webhook-handler.ts   # Santi-specific payload builders
│   └── sync-handler.ts      # Bundle/product sync logic
└── rockhouse/
    ├── manifest.json
    └── ...
```

**Manifest Example — `apps/api/src/integrations/santi-living/manifest.json`**

```json
{
  "appId": "santi-living",
  "name": "Santi Living",
  "version": "1.0.0",
  "description": "Mattress rental integration for Santi Living",
  "icon": "CubeIcon",
  "capabilities": ["rental:read", "rental:write", "webhook:order"],
  "configSchema": {
    "webhookUrl": { "type": "string", "format": "uri" },
    "paths": {
      "newOrder": {
        "type": "string",
        "default": "/api/orders/{token}/notify-admin"
      },
      "paymentStatus": {
        "type": "string",
        "default": "/api/orders/{token}/notify-payment"
      }
    }
  },
  "router": "./router.ts",
  "webhookHandler": "./webhook-handler.ts"
}
```

**Registry Concept**:

```typescript
// apps/api/src/integrations/registry.ts
export class IntegrationRegistry {
  private plugins = new Map<string, IntegrationPlugin>();

  register(manifest: IntegrationManifest, plugin: IntegrationPlugin) {
    this.plugins.set(manifest.appId, plugin);
  }

  get(appId: string): IntegrationPlugin | undefined {
    return this.plugins.get(appId);
  }

  list(): IntegrationManifest[] {
    return Array.from(this.plugins.values()).map((p) => p.manifest);
  }
}
```

---

### Phase 3: Generalize Webhook System (Event-Driven Architecture)

**Goal**: Replace `RentalWebhookOutbox` with a generic `EventOutbox` that any integration can subscribe to.

**New Models**:

```prisma
model EventCatalog {
  id          String   @id @default(cuid())
  eventName   String   @unique // "order.created", "payment.confirmed", "order.cancelled"
  description String?
  schema      Json?    // JSON Schema for payload validation
}

model EventSubscription {
  id            String @id @default(cuid())
  integrationId String
  eventName     String
  webhookUrl    String
  webhookSecret String?
  isActive      Boolean @default(true)

  integration Integration @relation(fields: [integrationId], references: [id])
}

model EventOutbox {
  id            String   @id @default(cuid())
  eventName     String
  companyId     String
  payload       Json
  status        OutboxStatus @default(PENDING)
  attempts      Int @default(0)
  nextAttemptAt DateTime @default(now())
  createdAt     DateTime @default(now())
}
```

**Publisher API**:

```typescript
// apps/api/src/services/event-publisher.ts
await eventPublisher.publish('order.created', {
  companyId: order.companyId,
  payload: { orderId: order.id, orderNumber: order.orderNumber },
});
```

**Integration Plugin implements Handler**:

```typescript
// apps/api/src/integrations/santi-living/webhook-handler.ts
export class SantiLivingWebhookHandler implements WebhookHandler {
  buildPayload(event: DomainEvent): unknown {
    if (event.name === 'order.created') {
      return {
        action: 'new_order',
        orderNumber: event.payload.orderNumber,
        customerName: event.payload.partner?.name,
        // ...
      };
    }
    // ...
  }
}
```

---

### Phase 4: API Key & Permission Model yang Generic (Capability-Based)

**Goal**: Replace hardcoded `['rental:read', 'rental:write']` with capability grants derived from the integration manifest.

```prisma
model Capability {
  id          String @id @default(cuid())
  name        String @unique // "rental:read", "inventory:write", "webhook:send"
  description String?
}

model IntegrationCapability {
  integrationId String
  capabilityId  String
  @@id([integrationId, capabilityId])
}
```

**API Key Service Update**:

```typescript
// apps/api/src/services/api-key.service.ts
async createKey(
  companyId: string,
  integrationId: string,
  name: string
): Promise<CreateKeyResult> {
  const capabilities = await this.getCapabilitiesForIntegration(integrationId);
  // ... generate key with capabilities instead of hardcoded array
}
```

---

### Phase 5: Extract Santi Living sebagai Integration Plugin

**Goal**: Move all Santi-specific code out of core into `apps/api/src/integrations/santi-living/`.

**Migration Checklist**:

| Current Location                                                             | Target Location                                                          |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `integration.service.ts:28-43` (hardcoded catalog)                           | `integrations/santi-living/manifest.json`                                |
| `rental-bundle.service.ts:154-251` (`syncFromSantiLiving`)                   | `integrations/santi-living/sync-handler.ts`                              |
| `rental-external-order.service.ts:196` (`createdBy: 'santi-living-website'`) | Generic `orderSource: OrderSource.WEBSITE` + `IntegrationOrder` junction |
| `public-rental-order.router.ts` (all Santi comments)                         | `integrations/santi-living/router.ts`                                    |
| `public-rental-payment.router.ts:21` (Santi comment)                         | `integrations/santi-living/webhook-handler.ts`                           |
| `rental-webhook-outbox.service.ts` (hardcoded paths)                         | `integrations/santi-living/webhook-handler.ts`                           |
| `bot/src/utils/formatter.ts` (brand name)                                    | Use `company.tenantBrandName`                                            |
| `web/src/utils/format.ts` (`getSantiLivingAssetUrl`)                         | Generic `getExternalAssetUrl(integrationId, path)`                       |
| `seed.ts:555-658` (Santi seed)                                               | `integrations/santi-living/seed.ts` or remove from core seed             |

---

### Phase 6: Generic Public Order API

**Goal**: Rename `publicRental` to `publicOrder` and make it business-shape agnostic.

**Router Restructure**:

```typescript
// apps/api/src/trpc/routers/public-order.router.ts
export const publicOrderRouter = router({
  // Generic order lifecycle
  createOrder: apiKeyProcedure...,
  getByToken: publicProcedure...,
  updateOrder: apiKeyProcedure...,
  deleteOrder: apiKeyProcedure...,

  // Generic partner
  findOrCreatePartner: apiKeyProcedure...,

  // Generic payment
  updatePaymentMethod: apiKeyProcedure...,
  confirmPayment: apiKeyProcedure...,
  confirmPaymentByOrderNumber: apiKeyProcedure...,
  rejectPaymentByOrderNumber: apiKeyProcedure...,
});
```

**Category Abstraction**:

Instead of `z.enum(['package', 'mattress', 'accessory'])`, accept:

```typescript
{
  category: z.string().min(1), // Free-form, validated by plugin if needed
  categorySchema: z.string().optional(), // Reference to manifest-defined schema
}
```

---

## 4. Action Plan Prioritas

### P0 — Blocker untuk Multi-Tenant

| #   | Task                                                 | File(s)                                    | Acceptance Criteria                                                       |
| --- | ---------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| 1   | Remove hardcoded `createdBy: 'santi-living-website'` | `rental-external-order.service.ts:196`     | Use `orderSource: OrderSource.WEBSITE` + `IntegrationOrder` junction      |
| 2   | Remove hardcoded SKU prefix `SL-`                    | `rental-external-order.service.ts:1057`    | Make prefix configurable per integration or use generic `EXT-`            |
| 3   | Decouple `AVAILABLE_INTEGRATIONS` from source code   | `integration.service.ts:28-56`             | Load from DB + manifest files; no rebuild required to add tenant          |
| 4   | Remove Santi-specific seed data from core            | `packages/database/prisma/seed.ts:550-658` | Seed only generic data; move Santi seed to plugin folder                  |
| 5   | Make `publicRental` router generic                   | `trpc/routers/public-rental.*`             | Rename to `publicOrder`; remove Santi comments; accept generic categories |

### P1 — High Impact SaaS Readiness

| #   | Task                                           | File(s)                                                            | Acceptance Criteria                                                 |
| --- | ---------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| 6   | Create `IntegrationManifest` schema + registry | New: `integrations/manifest.schema.ts`, `integrations/registry.ts` | Can register/unregister integrations at runtime                     |
| 7   | Extract Santi bundle sync logic                | `rental-bundle.service.ts:154-251`                                 | Move to `integrations/santi-living/sync-handler.ts`                 |
| 8   | Generalize webhook outbox                      | `rental-webhook-outbox.service.ts`                                 | Replace `RentalWebhookDeliveryType` enum with generic `EventOutbox` |
| 9   | Capability-based API keys                      | `api-key.service.ts`, `integration.router.ts`                      | Permissions derived from manifest capabilities, not hardcoded array |
| 10  | Remove Santi asset URL hardcoding              | `web/src/utils/format.ts`, `RentalBundlesPage.tsx`                 | Generic asset resolver using integration config                     |

### P2 — Medium Impact / Technical Debt

| #   | Task                                                 | File(s)                                                                          | Acceptance Criteria                                                      |
| --- | ---------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 11  | Rename `// Santi Living Integration Fields` comments | `schema.prisma:1067`, `deploy/api-mcp/prisma/schema.prisma:1067`                 | Generic comments or remove entirely                                      |
| 12  | Make bot formatter brand-agnostic                    | `apps/bot/src/utils/formatter.ts`                                                | Use `company.tenantBrandName` from API context                           |
| 13  | Remove Santi-specific frontend labels                | `RentalOrderDetail.tsx:117`, `RentalOrdersPage.tsx:318`, `RentalBundlesPage.tsx` | Generic "External Order" tooltip; sync button text from integration name |
| 14  | Refactor E2E test                                    | `santi-living-live-order-flow.test.ts`                                           | Generic multi-tenant E2E test that can target any integration plugin     |
| 15  | Add `IntegrationOrder` junction table                | New migration                                                                    | Link every external order to its source integration                      |

### P3 — Polish & Future-Proofing

| #   | Task                                      | File(s)                         | Acceptance Criteria                                                |
| --- | ----------------------------------------- | ------------------------------- | ------------------------------------------------------------------ |
| 16  | Plugin hot-reload / discovery             | `integrations/registry.ts`      | Watch `integrations/` folder and auto-register new plugins         |
| 17  | JSON Schema validation for event payloads | `event-catalog.service.ts`      | Invalid payloads rejected before enqueue                           |
| 18  | Integration SDK package                   | New: `packages/integration-sdk` | Shared types and base classes for third-party plugin authors       |
| 19  | Admin UI for integration marketplace      | `apps/web`                      | UI to browse, install, configure integrations without code changes |
| 20  | Webhook replay / dead-letter UI           | `apps/web`                      | View and retry failed webhook deliveries per integration           |

---

## 5. Diagram Arsitektur Jangka Panjang

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL TENANTS                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │ Santi Living │  │  Rockhouse   │  │   POS Lite   │  │   Custom Tenant N   │  │
│  │  (Website)   │  │   (Website)  │  │   (Website)  │  │      (Website)      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────────┬──────────┘  │
│         │                 │                 │                     │             │
│         └─────────────────┴─────────────────┴─────────────────────┘             │
│                                     │                                             │
│                              HTTP / tRPC / REST                                  │
│                                     ▼                                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                           SYNC ERP — PLATFORM LAYER                              │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                         INTEGRATION SDK                                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │   │
│  │  │   Manifest  │  │   Router    │  │   Webhook   │  │   Event Handler │  │   │
│  │  │   Schema    │  │   Factory   │  │   Builder   │  │   Interface     │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                      INTEGRATION REGISTRY                                 │   │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │   │
│  │  │  integrations/                                                      │  │   │
│  │  │  ├── santi-living/  (manifest.json + router.ts + webhook-handler.ts)│  │   │
│  │  │  ├── rockhouse/     (manifest.json + router.ts + webhook-handler.ts)│  │   │
│  │  │  ├── pos-lite/      (manifest.json + router.ts + webhook-handler.ts)│  │   │
│  │  │  └── custom-tenant/ (dynamically loaded at runtime)                │  │   │
│  │  └────────────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                      GENERIC PUBLIC ORDER API                             │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────────┐  │   │
│  │  │  Partner   │  │   Order    │  │  Payment   │  │   Asset / Bundle   │  │   │
│  │  │  (CRUD)    │  │  (CRUD)    │  │  (CRUD)    │  │   (Sync)           │  │   │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                      EVENT-DRIVEN WEBHOOK SYSTEM                          │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌───────────┐  │   │
│  │  │ EventCatalog│───▶│  Publisher  │───▶│  Outbox     │───▶│  Worker   │  │   │
│  │  │  (Schema)   │    │  (Emit)     │    │  (Queue)    │    │  (Deliver)│  │   │
│  │  └─────────────┘    └─────────────┘    └─────────────┘    └─────┬─────┘  │   │
│  │                                                                  │        │   │
│  │                    ┌─────────────────────────────────────────────┘        │   │
│  │                    ▼                                                      │   │
│  │            ┌───────────────┐    ┌───────────────┐    ┌───────────────┐   │   │
│  │            │ Subscription  │    │  Integration  │    │   Dead-Letter │   │   │
│  │            │   Registry    │    │   Webhook     │    │     Queue     │   │   │
│  │            └───────────────┘    └───────────────┘    └───────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                      CORE ERP (Business Agnostic)                         │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │   │
│  │  │  Rental  │ │  Sales   │ │ Inventory│ │  Accounting│ │  Partner    │   │   │
│  │  │  Order   │ │  Order   │ │  Mgmt    │ │  (Journal) │ │  Mgmt       │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                      MULTI-TENANT FOUNDATION                              │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │   │
│  │  │ Company  │ │   User   │ │ API Key  │ │  Role    │ │  Permission   │   │   │
│  │  │ (Tenant) │ │ (Auth)   │ │ (Access) │ │  (RBAC)  │ │  (Capability) │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Appendix: Full File Index of Findings

| Layer   | File                                                                          | Lines                             | Finding Type                 |
| ------- | ----------------------------------------------------------------------------- | --------------------------------- | ---------------------------- |
| DB      | `packages/database/prisma/schema.prisma`                                      | 202-203, 226, 974, 1067-1080      | Comments, field block        |
| DB      | `deploy/api-mcp/prisma/schema.prisma`                                         | 202-203, 226, 974, 1067-1080      | Duplicated comments          |
| DB      | `packages/database/prisma/seed.ts`                                            | 555-658                           | Hardcoded seed data          |
| Service | `apps/api/src/services/integration.service.ts`                                | 28-56                             | Hardcoded catalog            |
| Service | `apps/api/src/modules/rental/rental-bundle.service.ts`                        | 154-251                           | Santi sync logic             |
| Service | `apps/api/src/modules/rental/rental-external-order.service.ts`                | 196, 1057                         | Hardcoded string, SKU prefix |
| Service | `apps/api/src/modules/rental/rental-webhook-outbox.service.ts`                | 784                               | Hardcoded path default       |
| Router  | `apps/api/src/trpc/router.ts`                                                 | 23, 36                            | Santi comments               |
| Router  | `apps/api/src/trpc/routers/public-rental.router.ts`                           | 5                                 | Santi comment                |
| Router  | `apps/api/src/trpc/routers/public-rental/public-rental-order.router.ts`       | 47, 125, 140, 159, 211, 286       | Multiple Santi refs          |
| Router  | `apps/api/src/trpc/routers/public-rental/public-rental-partner.router.ts`     | 16                                | Santi comment                |
| Router  | `apps/api/src/trpc/routers/public-rental/public-rental-payment.router.ts`     | 21                                | Santi comment                |
| Router  | `apps/api/src/trpc/routers/rental-bundle.router.ts`                           | 87, 99-100, 120                   | Santi procedures             |
| Router  | `apps/api/src/trpc/routers/integration.router.ts`                             | 36, 78, 144                       | Hardcoded perms              |
| Web     | `apps/web/src/features/rental/pages/RentalBundlesPage.tsx`                    | 15, 39, 58, 63, 150, 164, 257-258 | Santi UI strings             |
| Web     | `apps/web/src/features/rental/pages/RentalOrderDetail.tsx`                    | 117                               | Santi tooltip                |
| Web     | `apps/web/src/features/rental/pages/RentalOrdersPage.tsx`                     | 318                               | Santi tooltip                |
| Web     | `apps/web/src/utils/format.ts`                                                | 30-45                             | Santi asset URL              |
| Bot     | `apps/bot/src/server.ts`                                                      | 29                                | Santi service name           |
| Bot     | `apps/bot/src/utils/formatter.ts`                                             | 22                                | Santi brand name             |
| Test    | `apps/api/test/e2e/santi-living-live-order-flow.test.ts`                      | 24, 84, 88, 436                   | Santi test fixtures          |
| Test    | `apps/api/test/integration/rental/rental-webhook-outbox.admin-router.test.ts` | 43, 57, 62                        | Santi test data              |

---

_End of Report_
