# API Contracts

This feature is **frontend-only** and does not require any new API endpoints.

All data needed for onboarding progress tracking is available from existing endpoints:

| Data           | Endpoint                  | Already Used By  |
| -------------- | ------------------------- | ---------------- |
| Product count  | `GET /products`           | dashboardService |
| Order count    | `GET /sales-orders`       | dashboardService |
| Supplier count | `GET /partners/suppliers` | Suppliers page   |
| Customer count | `GET /partners/customers` | Customers page   |
| Account count  | `GET /finance/accounts`   | Finance page     |
