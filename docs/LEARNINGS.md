# Developer Learning Points & Insights

**Date:** December 15, 2025
**Project:** Sync ERP

This document captures key technical learnings, architectural decisions, and "gotchas" encountered during the development of the Sales, Procurement, and Finance modules.

---

## 1. Architectural Patterns & Best Practices

### The "Parity Principle" in ERP Design

One of the strongest drivers for our recent productivity was enforcing **Symmetry** between related modules. Code reusability is not just about sharing functions, but sharing _mental models_.

- **Procurement ↔ Sales**: `PurchaseOrder` and `SalesOrder` share nearly identical structures (Items, Partners, Taxes). Structure the code similarly to make context switching easier.
- **Payables ↔ Receivables**: `Bill` (Vendor) and `Invoice` (Customer) are mirror images.
- **Implementation Strategy**: When implementing a feature (e.g., "Create Invoice from SO"), always immediately ask: "Does the equivalent (Create Bill from PO) exist?" Implement them in pairs.

### Three-Layer Backend Architecture

We strictly follow **Controller → Service → Repository**.

- **Controller**: Handles HTTP, DTO validation, and Response formatting. _Should not contain business logic._
- **Service**: Contains business logic (calculations, complex checks like stock availability, cross-module calls).
- **Repository**: Handles direct Database/ORM access. _Should not contain business logic._
  - _Key Learning_: Keep Prisma `include` logic in the Repository. Services should ask Repositories for "Orders with Invoices", not fetch Orders and then fetch Invoices separately.

---

## 2. Frontend Performance & Data Fetching

### avoiding the Client-Side N+1 Problem

**The Incident:** We encountered severe performance issues and console errors (404s) when the Sales Order list tried to fetch status for every single specific order individually.

**The Anti-Pattern:**

```typescript
// ❌ BAD: Fetching list, then looping to fetch details
const orders = await listOrders();
for (const order of orders) {
  const invoice = await getInvoiceByOrder(order.id); // N Requests!
}
```

**The Solution (Eager Loading):**
Leverage the Backend's ability to join data.

```typescript
// ✅ GOOD: Fetch everything in one go
// Backend (Repository)
return prisma.order.findMany({ include: { invoices: true } });

// Frontend
orders.map(order => <div>{order.invoices[0]?.status}</div>);
```

**Takeaway:** If you are calling an API inside a loop or `useEffect` that depends on a list, you are likely creating a performance bottleneck. Move the logic to the backend `include` or `join`.

### UI State Management

- **Optimistic Updates**: Using `loadData()` to refresh the entire table is safer but slower. For simple status changes (e.g., "Ship"), modifying the local state immediately (Optimistic UI) usually provides a better UX, but requires careful sync with the backend. We currently use "Action -> Await -> Refresh", which is robust but network-heavy.

---

## 3. Error Handling & User Experience

### The "Toast Trap"

**Issue:** Our global API interceptor was configured to show a Red Error Toast for **ALL** errors, including 404s.
**Impact:** Harmless checks (e.g., "Does this order have an invoice?") resulted in scary error messages for the user.
**Fix:**

1. **Frontend**: Don't suppress errors blindly with `any` types.
2. **Architecture**: Avoid the error condition entirely (see N+1 fix above).
3. **Policy**: 404s are often "Expected logic flows" (e.g., Resource not found -> Create new one), not "System Exceptions". Global handlers must discriminate or allow overrides.

---

## 4. Prisma & Database Modeling

### Relation vs Field

- We learned to rely on Prisma's auto-generated relations.
- **One-to-Many Semantics**: Even if logically "1 Sales Order has 1 Invoice", the database often models this as `Order` -> `Invoice[]` (One-to-Many) for flexibility (e.g., partial invoicing in the future).
- **Frontend Adaptation**: Always check array length or safe access (`invoices?.[0]`) rather than assuming a single object field unless the schema explicitly enforces `@unique`.

---

## 5. Development Workflow (Agentic)

### Context is King

- Providing the AI/Agent with "Related Files" (e.g., showing `PurchaseOrder.tsx` when working on `SalesOrder.tsx`) drastically improves code quality by enabling checking for consistency/parity.
- **Iterative Refactoring**: Don't settle for "Quick Fixes" (like suppressing errors). Always push for the "Root Cause Fix" (Refactoring the data fetch strategy) once the immediate fire is put out.

---

## Action Items / Future Improvements

- [ ] **Shared Types**: Move Frontend locally defined interfaces (`SalesOrder`, `PurchaseOrder`) to `@sync-erp/shared` to guarantee they match the Backend DTOs.
- [ ] **Status Badge Component**: Extract the duplicated `getStatusColor` and `getInvoiceStatusBadge` logic into a shared UI component to ensure consistency across the app.
