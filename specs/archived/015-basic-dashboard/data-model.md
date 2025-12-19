# Data Model: Dashboard

**No database changes required.**

## Existing Entities Used

Dashboard reads from existing entities via API, no new data models needed.

| Entity  | API Endpoint            | Fields Used         |
| ------- | ----------------------- | ------------------- |
| Invoice | `GET /api/invoices`     | `balance`, `status` |
| Bill    | `GET /api/bills`        | `balance`, `status` |
| Order   | `GET /api/sales-orders` | `status`            |
| Product | `GET /api/products`     | `id` (count)        |

## Computed Metrics

| Metric            | Calculation                                      |
| ----------------- | ------------------------------------------------ |
| Total Receivables | SUM of `invoice.balance` where `status = POSTED` |
| Total Payables    | SUM of `bill.balance` where `status = POSTED`    |
| Pending Orders    | COUNT of orders where `status != COMPLETED`      |
| Products Count    | COUNT of all products                            |
| Unpaid Invoices   | COUNT of invoices where `status = POSTED`        |
| Unpaid Bills      | COUNT of bills where `status = POSTED`           |

## Notes

- All calculations are performed client-side from existing API responses
- No aggregate endpoints needed - existing list APIs provide sufficient data
- Multi-tenant isolation maintained via existing API middleware (companyId context)
