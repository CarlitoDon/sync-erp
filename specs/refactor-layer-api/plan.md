# Refactor Plan: Layered Architecture Migration

## 0. Context & Goal

The current backend has mixed responsibilities:

- **Routes** contain Controller logic (parsing, validation, error handling).
- **Services** contain Domain logic mixed with Repository logic (direct Prisma access).
- **Goal**: Separate into `Controller` (HTTP), `Service` (Business), `Repository` (DB) layers, organized by Domain Modules.

## 1. Module Mapping

| Existing Service           | Target Module                 | Components                                                       |
| :------------------------- | :---------------------------- | :--------------------------------------------------------------- |
| `SalesOrderService.ts`     | `sales`                       | `SalesController`, `SalesService`, `SalesRepository`             |
| `PurchaseOrderService.ts`  | `procurement`                 | `POController`, `POService`, `PORepository`                      |
| `BillService.ts`           | `procurement` (or accounting) | `BillController`, `BillService`, `BillRepository`                |
| `InventoryService.ts`      | `inventory`                   | `InventoryController`, `InventoryService`, `InventoryRepository` |
| `FulfillmentService.ts`    | `shipping`                    | `ShippingController`, `ShippingService`, `ShippingRepository`    |
| `JournalService.ts`        | `accounting`                  | `JournalController`, `JournalService`, `JournalRepository`       |
| `AccountService.ts`        | `accounting`                  | `AccountController`, `AccountService`, `AccountRepository`       |
| `PaymentService.ts`        | `accounting`                  | `PaymentController`, `PaymentService`, `PaymentRepository`       |
| `InvoiceService.ts`        | `sales` (or accounting)       | `InvoiceController`, `InvoiceService`, `InvoiceRepository`       |
| `ProductService.ts`        | `product`                     | `ProductController`, `ProductService`, `ProductRepository`       |
| `PartnerService.ts`        | `customer`                    | `PartnerController`, `PartnerService`, `PartnerRepository`       |
| `authService.ts`           | `auth`                        | `AuthController`, `AuthService`, `AuthRepository`                |
| `UserService.ts`           | `auth`                        | `UserController`, `UserService`, `UserRepository`                |
| `DocumentNumberService.ts` | `core` or `utils`             | `DocNumService`                                                  |
| `ReportService.ts`         | `reporting`                   | `ReportController`, `ReportService`                              |

## 2. Directory Structure

```
apps/api/src/modules/
  sales/
    sales.controller.ts
    sales.service.ts
    sales.repository.ts
  procurement/
  inventory/
  accounting/
  product/
  customer/
  auth/
  shipping/
  reporting/
```

## 3. Migration Order

1.  **Setup**: Create folder structure.
2.  **Product Module**: Simple (CRUD). Good first candidate.
3.  **Customer Module**: Simple (Partner).
4.  **Sales Module**: Complex (depends on Product, Inventory).
5.  **Inventory Module**: Complex (depends on Product).
6.  **Procurement Module**: Complex.
7.  **Accounting Module**: Core (depends on others).
8.  **Auth Module**: Critical.
9.  **Cleanup**: Remove old files.

## 4. Implementation Steps (Per Module)

1.  **Repository**: Extract Prisma calls from old Service to `module/repository.ts`.
2.  **Service**: Move domain logic to `module/service.ts`, injecting Repository.
3.  **Controller**: Move route logic to `module/controller.ts`, calling Service.
4.  **DTOs**: Define Zod schemas in `module/dto/`.
5.  **Routes**: Update `apps/api/src/routes/` to bind Controller methods. (Later move routes to `module/routes.ts` if needed, but for now keep central routes ref referencing controllers).
