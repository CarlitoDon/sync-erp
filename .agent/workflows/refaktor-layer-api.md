---
# Specify the following for Cursor rules
description: Guidelines for refactoring an existing single-layer service codebase into a complete three-layer architecture (Controller / Service / Repository) across all modules
alwaysApply: false
---

# Three-Layer Architecture Migration Assistant (Full-Project Refactor)

**Role:** You are a precise, module-oriented refactoring assistant. Apply the steps below to transform a system where all HTTP, business logic, and persistence logic are mixed inside service files into a clean, domain-based three-layer architecture. Preserve existing functionality, introduce no breaking changes, and avoid speculative rewrites.

---

## 0) Detect Context & Prepare Refactor Plan

1. Scan entire project:
   - Locate all service files under `/src/services`, `/src/modules`, or other ad hoc paths.
   - Identify functions that contain:
     - Request parsing (HTTP layer mixed inside)
     - Domain/business rules
     - Direct Prisma access
     - Cross-module orchestration

2. Categorize each service by responsibility:
   - **Type A: Mixed (Controller + Service + Repository)**  
     High priority for refactor.
   - **Type B: Service + Repository only**  
     Medium priority.
   - **Type C: Pure domain logic**  
     Lowest priority.

3. Identify all domain boundaries:
   - **Sales**
   - **Procurement**
   - **Inventory**
   - **Accounting**
   - **Product**
   - **Customer**
   - **Auth / User / RBAC**
   - **Shipping / Fulfillment (if present)**
   - **Reporting (optional)**

> Output must retain behavior of every feature after refactor.

---

## 1) Define Canonical Folder Structure For All Modules

Create the full predictable layout:

```

/src
/modules
/sales
sales.controller.ts
sales.service.ts
sales.repository.ts
dto/
/procurement
purchaseOrder.controller.ts
purchaseOrder.service.ts
purchaseOrder.repository.ts
dto/
/inventory
inventory.controller.ts
inventory.service.ts
inventory.repository.ts
dto/
/accounting
journal.controller.ts
journal.service.ts
journal.repository.ts
dto/
/product
product.controller.ts
product.service.ts
product.repository.ts
dto/
/customer
customer.controller.ts
customer.service.ts
customer.repository.ts
dto/
/auth
auth.controller.ts
auth.service.ts
auth.repository.ts
dto/
/shipping
shipping.controller.ts
shipping.service.ts
shipping.repository.ts
dto/
/core
/database
/errors
/utils
/middlewares
/routes

````

Rules:
- Every domain gets exactly three files by default: controller, service, repository.
- If domain does not require repository (e.g. pure logic), keep empty placeholder for future.
- DTO folder exists for each domain.

---

## 2) Extract Controllers Across All Services

### 2.1 Controller Candidate Detection
Search all service codebase for anything involving:

- `req.body`, `req.params`, `req.query`
- `res.json`
- `res.status`
- Manual validation of user input
- Explicit route logic inside services (e.g., `/po/:id` routing)

Mark all as “Controller Logic”.

### 2.2 Move to `<domain>.controller.ts`

Example:

```ts
class SalesController {
  async createOrder(req, res) {
    const dto = req.body
    const result = await salesService.createOrder(dto)
    return res.json(result)
  }
}
````

Controllers must contain:

* Input extraction
* Input validation (or delegated validation)
* Mapping to service calls

Controllers must NOT contain:

* Database access
* Business rules
* Cross-domain orchestration

---

## 3) Extract Repositories Across All Services

### 3.1 Identify Persistence Logic

Search each service for direct Prisma code:

* `prisma.product.create()`
* `prisma.salesOrder.findMany()`
* `prisma.journalEntry.update()`
* `$transaction()` blocks

Mark these as “Repository Logic”.

### 3.2 Create `<domain>.repository.ts`

Each aggregate root receives a repository.

Examples:

**Sales Repository**

```ts
class SalesRepository {
  create(data, tx) {
    return prisma.salesOrder.create({ data, tx })
  }
  findById(id) {
    return prisma.salesOrder.findUnique({ where: { id } })
  }
}
```

**Product Repository**

```ts
class ProductRepository {
  findAll() {
    return prisma.product.findMany()
  }
}
```

Repository rules:

* Contains only DB operations
* No business rules
* No HTTP concerns
* Returns raw DB objects

---

## 4) Rewrite Every Service As Pure Domain / Orchestration

### 4.1 Identify Domain Logic

From each existing service, extract:

* Calculations (totals, tax, discounts)
* Cross-module calls (PO triggers journal, sales triggers stock movement)
* Validation of business rules
* Multi-step use-cases (create, update, confirm, approve)
* Transaction orchestration

### 4.2 Normalize into `<domain>.service.ts`

Example across modules:

**Sales Service**

```ts
class SalesService {
  async createOrder(dto) {
    return prisma.$transaction(async tx => {
      const order = await salesRepository.create(dto, tx)
      await inventoryService.reserveStock(order.items, tx)
      return order
    })
  }
}
```

**Inventory Service**

```ts
class InventoryService {
  async reserveStock(items, tx) {
    for (const item of items) {
      await inventoryRepository.decreaseStock(item.productId, item.qty, tx)
    }
  }
}
```

**Accounting Service**

```ts
class AccountingService {
  async recordSale(order, tx) {
    const lines = this.composeJournalLines(order)
    return journalRepository.create({ refType: 'SO', refId: order.id, lines }, tx)
  }
}
```

Service rules:

* Contains business logic
* Contains cross-module orchestration
* Does not know about HTTP

---

## 5) Migrate All Endpoints to Use Controllers

Before:

```
router.post('/sales', salesService.createOrder)
```

After:

```
router.post('/sales', salesController.createOrder)
```

Perform migration for all modules:

* Sales
* Procurement
* Accounting
* Inventory
* Product
* Customer
* Auth
* Shipping

---

## 6) Introduce DTO Validation Layer

### 6.1 Extract Request Shapes

Analyze each service method’s existing uses of `req.body`.

### 6.2 Create DTO Files

Examples:

```
/modules/sales/dto/createOrder.dto.ts
/modules/accounting/dto/createJournal.dto.ts
/modules/product/dto/createProduct.dto.ts
```

Use zod/yup or plain TypeScript.

### 6.3 Replace Inline Input Checks

Controllers perform validation; services no longer validate raw HTTP bodies.

---

## 7) Regression Verification Across All Modules

### 7.1 Sales Module Tests

* Create order
* Update order
* Calculate totals
* Trigger stock reduction
* Ledger integration

### 7.2 Procurement Module Tests

* Create PO
* Create PO items
* Approve PO
* Trigger accounting journal

### 7.3 Inventory Module Tests

* Increase/decrease stock
* Stock reservation workflow
* Stock movement histories

### 7.4 Accounting Module Tests

* Debit/credit correctness
* Journal posting
* Reference integrity

### 7.5 Product Module Tests

* Product CRUD
* Price updates

### 7.6 Customer Module Tests

* Customer creation
* Update address/contact

### 7.7 Auth Module Tests

* Login
* Token generation
* Role/permission checks

All behaviors must match pre-refactor state.

---

## 8) Remove Legacy Code

Eliminate:

* Old service functions containing HTTP logic
* Direct route calls to service methods
* Inline Prisma calls lingering in services
* Duplicated validation logic

Verify no old imports remain in modules.

---

## 9) Deliverables

### After refactor, system must have:

* Dedicated controllers for all modules
* Clean service layer with only business logic
* Repository layer handling all persistence
* DTO validation for every endpoint
* Unified folder structure
* Full backward compatibility

Delivered artifacts:

* controller/service/repository for every module
* updated route bindings
* regression test logs
* summary of removed/deprecated code

---

## 10) Optional Enhancements (Phase 2)

* Introduce Application Service Layer for multi-domain workflows
* Add Domain Events (e.g., `SalesOrderCreated → CreateJournal → UpdateStock`)
* Add Unit of Work abstraction for transaction boundary control
* Replace in-service orchestration with Saga pattern for long-running flows
* Auto-generate OpenAPI schemas from DTOs

---

# End of Workflow

```
