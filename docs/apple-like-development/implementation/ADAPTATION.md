# Business Shape Adaptation: Retail vs Manufacturing vs Service

> This is not just UX; it is an architectural decision tree. One simple choice by the user triggers 100 derived system decisions.

## 1. Core Principles (Apple-Style Foundation)

**User enters one sentence. System takes 100 decisions.**
The user **NEVER** explicitly chooses:

- Costing Method
- Inventory Structure
- Chart of Accounts (CoA) Template

These are all _implicit consequences_ of the Business Shape selection.

## 2. High-Level Comparison

| Dimension           | Retail            | Manufacturing             | Service        |
| :------------------ | :---------------- | :------------------------ | :------------- |
| **Inventory**       | Simple Stock      | Multi-layer (Raw/Fin/WIP) | None           |
| **Costing**         | Average           | Standard (Default)        | N/A            |
| **Production**      | ❌                | ✅                        | ❌             |
| **BOM**             | ❌                | ✅ (Mandatory)            | ❌             |
| **WIP**             | ❌                | ✅                        | ❌             |
| **Purchasing**      | Goods             | Raw Material              | Expense        |
| **Accounting**      | Medium Complexity | High Complexity           | Low Complexity |
| **Onboarding Time** | 7–8 mins          | 10–12 mins                | 5 mins         |

## 3. Onboarding Flow Impact

### A. If User Chooses RETAIL

**3.1 Active Modules**

- Products (Goods)
- Inventory (Simple)
- Purchasing
- Sales
- Basic Accounting

**3.2 Hidden Modules**

- BOM, Production Order, Work Center, WIP Accounting.

**3.3 Onboarding Adjustment**

- **PRODUCT_SETUP**: Default type is "Stock Item". "Non-stock" is hidden.
- **FIRST_TRANSACTION**: Allowed flow: Purchase → Receive → Stock Increase.
- **Blocked**: Production, Assembly.

**3.4 Accounting Defaults**

- **Asset**: Inventory Asset.
- **COGS**: Average Costing.
- **Philosophy**: Retail is about _velocity_, not manufacturing precision.

---

### B. If User Chooses MANUFACTURING (Most Critical)

**3.5 Active Modules**

- Raw Material Inventory
- Finished Goods Inventory
- BOM (Bill of Materials)
- Production Order
- WIP (Work In Progress)
- Purchasing
- Advanced Accounting

**3.6 Forced Modules (Hard Enable)**

- BOM, Production, Inventory Valuation.
- _Note: User cannot disable these in MVP._

**3.7 Onboarding Machine Adjustment**
**New State Flow**:
`SYSTEM_SETUP` → **`MATERIAL_SETUP`** (Soft) → **`BOM_SETUP`** (Hard-Lite) → `OPENING_BALANCE` → **`FIRST_PRODUCTION`** (Hard) → `ALIVE_MOMENT`

- **MATERIAL_SETUP (Soft)**: Minimal inputs (Name, Unit). No Supplier/Cost yet.
- **BOM_SETUP (Hard-Lite)**:
  - Must select 1 Finished Good.
  - Must select ≥1 Raw Material.
  - _Why?_ Manufacturing makes no sense without a BOM.
- **FIRST_TRANSACTION (Production)**:
  - Action: Create Production Order → Consume Material → Produce Finished Good.
  - **Proves to User**: WIP works, Inventory moves, Journal is created.

**3.8 Accounting Defaults**

- **Raw Material**: Inventory Asset.
- **WIP**: Inventory Asset.
- **Finished Goods**: Inventory Asset.
- **Costing**: Standard.
- **Variance**: Hidden (Backend only for MVP).

---

### C. If User Chooses SERVICE

**Service is aggressive feature reduction.**

**3.9 Active Modules**

- Customers
- Invoicing
- Payments
- Accounting

**3.10 Totally Disabled Modules**

- Inventory
- Purchasing (Goods)
- BOM, Production

**3.11 Onboarding Adjustment**

- **PRODUCT_SETUP**: Input "Service Name", "Rate" (Optional). No Stock, Unit, or Warehouse.
- **FIRST_TRANSACTION**: Create Invoice → Receive Payment. (Not Purchase).

**3.12 Accounting Defaults**

- **Primary**: Revenue, Cash/Bank, Expense.
- **COGS**: Not applicable.

## 4. Sidebar & Navigation Impact

**Apple-Style Rule**: _Never show a menu that the user cannot understand today._
Sidebar is not a preference; it is a consequence.

| Business Shape    | Primary Sidebar Items       |
| :---------------- | :-------------------------- |
| **Retail**        | Inventory, Purchase, Sales  |
| **Manufacturing** | Production, BOM, Inventory  |
| **Service**       | Invoice, Customers, Finance |

## 5. Invariants (Strict Laws)

- **Retail**:
  - No Negative Stock allowed by default.
  - No manual GL journaling for inventory movements.
- **Manufacturing**:
  - No Production without BOM.
  - No Finished Goods without WIP transit.
- **Service**:
  - No Inventory Ledger exists.

## 6. Why This Matters

Without this strict adaptation:

1.  ERP feels generic and bloated.
2.  User gets confused by irrelevant options.
3.  Configuration errors are pushed to the user.

With this approach:

1.  System feels like it "understands" the business.
2.  User feels smart.
3.  Errors are prevented before they can happen.
