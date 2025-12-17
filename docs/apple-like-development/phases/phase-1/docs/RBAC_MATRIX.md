# Phase 1: RBAC Matrix

Mencegah RBAC jadi if-else chaos.

**Rule**: Tanpa dokumen ini, RBAC tidak boleh diimplementasi.

---

## Role Definitions

| Role            | Description                            |
| :-------------- | :------------------------------------- |
| **ADMIN**       | Full system access                     |
| **FINANCE**     | Invoice, Bill, Payment, Journal access |
| **SALES**       | Sales Order, Customer access           |
| **PROCUREMENT** | Purchase Order, Supplier access        |
| **INVENTORY**   | Stock, Product, Warehouse access       |

---

## Invoice Permissions

| Action             | ADMIN | FINANCE | SALES | PROCUREMENT | INVENTORY |
| :----------------- | :---: | :-----: | :---: | :---------: | :-------: |
| View Invoices      |  ✅   |   ✅    |  ✅   |     ❌      |    ❌     |
| Create Invoice     |  ✅   |   ✅    |  ✅   |     ❌      |    ❌     |
| Edit Draft Invoice |  ✅   |   ✅    |  ✅   |     ❌      |    ❌     |
| Post Invoice       |  ✅   |   ✅    |  ❌   |     ❌      |    ❌     |
| Void Invoice       |  ✅   |   ❌    |  ❌   |     ❌      |    ❌     |

---

## Bill Permissions

| Action          | ADMIN | FINANCE | SALES | PROCUREMENT | INVENTORY |
| :-------------- | :---: | :-----: | :---: | :---------: | :-------: |
| View Bills      |  ✅   |   ✅    |  ❌   |     ✅      |    ❌     |
| Create Bill     |  ✅   |   ✅    |  ❌   |     ✅      |    ❌     |
| Edit Draft Bill |  ✅   |   ✅    |  ❌   |     ✅      |    ❌     |
| Post Bill       |  ✅   |   ✅    |  ❌   |     ❌      |    ❌     |
| Void Bill       |  ✅   |   ❌    |  ❌   |     ❌      |    ❌     |

---

## Payment Permissions

| Action         | ADMIN | FINANCE | SALES | PROCUREMENT | INVENTORY |
| :------------- | :---: | :-----: | :---: | :---------: | :-------: |
| View Payments  |  ✅   |   ✅    |  ❌   |     ❌      |    ❌     |
| Create Payment |  ✅   |   ✅    |  ❌   |     ❌      |    ❌     |
| Cancel Payment |  ✅   |   ❌    |  ❌   |     ❌      |    ❌     |

---

## Sales Order Permissions

| Action             | ADMIN | FINANCE | SALES | PROCUREMENT | INVENTORY |
| :----------------- | :---: | :-----: | :---: | :---------: | :-------: |
| View Sales Orders  |  ✅   |   ✅    |  ✅   |     ❌      |    ❌     |
| Create Sales Order |  ✅   |   ❌    |  ✅   |     ❌      |    ❌     |
| Edit Draft SO      |  ✅   |   ❌    |  ✅   |     ❌      |    ❌     |
| Confirm SO         |  ✅   |   ❌    |  ✅   |     ❌      |    ❌     |
| Cancel SO          |  ✅   |   ❌    |  ❌   |     ❌      |    ❌     |

---

## Purchase Order Permissions

| Action                | ADMIN | FINANCE | SALES | PROCUREMENT | INVENTORY |
| :-------------------- | :---: | :-----: | :---: | :---------: | :-------: |
| View Purchase Orders  |  ✅   |   ✅    |  ❌   |     ✅      |    ❌     |
| Create Purchase Order |  ✅   |   ❌    |  ❌   |     ✅      |    ❌     |
| Edit Draft PO         |  ✅   |   ❌    |  ❌   |     ✅      |    ❌     |
| Confirm PO            |  ✅   |   ❌    |  ❌   |     ✅      |    ❌     |
| Cancel PO             |  ✅   |   ❌    |  ❌   |     ❌      |    ❌     |

---

## Inventory Permissions

| Action           | ADMIN | FINANCE | SALES | PROCUREMENT | INVENTORY |
| :--------------- | :---: | :-----: | :---: | :---------: | :-------: |
| View Stock       |  ✅   |   ❌    |  ✅   |     ✅      |    ✅     |
| Stock Adjustment |  ✅   |   ❌    |  ❌   |     ❌      |    ✅     |
| View Movements   |  ✅   |   ❌    |  ❌   |     ❌      |    ✅     |

---

## Master Data Permissions

| Action                   | ADMIN | FINANCE | SALES | PROCUREMENT | INVENTORY |
| :----------------------- | :---: | :-----: | :---: | :---------: | :-------: |
| Manage Products          |  ✅   |   ❌    |  ❌   |     ❌      |    ✅     |
| Manage Partners          |  ✅   |   ❌    |  ✅   |     ✅      |    ❌     |
| Manage Warehouses        |  ✅   |   ❌    |  ❌   |     ❌      |    ✅     |
| Manage Chart of Accounts |  ✅   |   ✅    |  ❌   |     ❌      |    ❌     |

---

## User Management Permissions

| Action           | ADMIN | FINANCE | SALES | PROCUREMENT | INVENTORY |
| :--------------- | :---: | :-----: | :---: | :---------: | :-------: |
| View Users       |  ✅   |   ❌    |  ❌   |     ❌      |    ❌     |
| Create User      |  ✅   |   ❌    |  ❌   |     ❌      |    ❌     |
| Update User Role |  ✅   |   ❌    |  ❌   |     ❌      |    ❌     |

---

_Document required before Phase 1 work proceeds._
