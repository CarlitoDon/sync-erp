# Sync ERP Integration API v1

Sync ERP exposes two integration transports over the same rental integration service:

- REST: `/api/v1`
- tRPC: `/api/trpc/integration/v1`

Use REST for universal integrations and OpenAPI-style documentation. Use tRPC when the partner app is TypeScript-first and wants end-to-end typed procedures.

## Authentication

All mutation and tenant-scoped read endpoints require:

```http
Authorization: Bearer <api_key>
Content-Type: application/json
```

Mutation endpoints may include `Idempotency-Key` to protect against duplicate retries.

## REST Endpoints

- `POST /api/v1/rental/customers`
- `POST /api/v1/rental/orders`
- `GET /api/v1/rental/orders/:id`
- `GET /api/v1/rental/orders/by-token/:publicToken`
- `GET /api/v1/rental/orders/by-number/:orderNumber`
- `PATCH /api/v1/rental/orders/:id`
- `POST /api/v1/rental/orders/:id/cancel`
- `POST /api/v1/rental/orders/:id/payments/claim`
- `POST /api/v1/rental/orders/:id/payments/confirm`
- `POST /api/v1/rental/orders/:id/payments/reject`
- `POST /api/v1/rental/orders/by-number/:orderNumber/payments/confirm`
- `POST /api/v1/rental/orders/by-number/:orderNumber/payments/reject`

## tRPC Procedures

- `integrationV1.rental.customers.create`
- `integrationV1.rental.orders.create`
- `integrationV1.rental.orders.get`
- `integrationV1.rental.orders.getByToken`
- `integrationV1.rental.orders.getByOrderNumber`
- `integrationV1.rental.orders.update`
- `integrationV1.rental.orders.cancel`
- `integrationV1.rental.payments.claim`
- `integrationV1.rental.payments.confirm`
- `integrationV1.rental.payments.reject`

## Webhook Events

Sync ERP emits generic tenant events only:

- `rental.order.created`
- `rental.order.updated`
- `rental.order.cancelled`
- `rental.payment.claimed`
- `rental.payment.confirmed`
- `rental.payment.rejected`

External apps own channel-specific delivery such as WhatsApp, email, customer checkout, and payment provider webhooks.
