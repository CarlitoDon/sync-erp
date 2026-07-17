# External Rental Storefront Integration

## Summary

Sync ERP supports rental storefront integrations through tenant API keys and the rental integration endpoints. External storefronts can submit customer rental orders, map package or item identifiers to ERP rental items, and receive webhook updates for order and payment status.

## Integration Shape

- Install a `custom-storefront` integration for the company.
- Generate an active API key scoped to that integration.
- Configure the storefront with Sync ERP API base URL, API key, and webhook receiver URL.
- Submit rental orders through the integration API with external customer, item/package, rental period, delivery, discount, and payment metadata.
- Use idempotency keys for order creation, payment notifications, and webhook retries.

## Operational Notes

- Sync ERP is the system of record for company, inventory/rental availability, invoices, payments, and accounting journals.
- The storefront remains the customer-facing checkout and order tracking surface.
- External IDs are stored as generic integration metadata, not as customer-specific fields.
- Storefront-specific implementation notes belong under `docs/case-studies/`, not the generic integration docs.

## Readiness Checklist

- API key generated and stored securely by the storefront.
- Webhook receiver has signature verification and idempotent handling.
- Order creation, payment confirmation, payment rejection, cancellation, and return flows are tested in staging.
- Product/package mapping is reviewed before launch so storefront SKUs do not silently create wrong ERP items.
