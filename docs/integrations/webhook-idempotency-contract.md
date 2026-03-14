# Webhook Idempotency Contract

This contract defines how Sync ERP sends deduplication metadata for webhook deliveries so receivers can handle retry/replay safely.

## Headers Sent by Sync ERP

Every outbox delivery now includes:

- `X-Webhook-Delivery-Id`: Stable identifier for one persisted outbox entry.
- `Idempotency-Key`: Same value as `X-Webhook-Delivery-Id` for systems that standardize on idempotency-key semantics.

The identifier stays constant across retries and manual replay of the same outbox record.

## Receiver Behavior

Receivers should treat `X-Webhook-Delivery-Id` (or `Idempotency-Key`) as a dedupe key:

1. If a key is seen for the first time, process normally and record it.
2. If the same key appears again, return success without repeating side effects.
3. Keep dedupe entries for a bounded TTL (for example 10 minutes) or persist longer if your replay window is longer.

## Current Implementation Scope

- Rental webhook outbox sender: includes both headers.
- Tenant webhook outbox sender: includes both headers.
- Santi Living proxy receiver: in-memory TTL dedupe middleware for `/api/orders/:token/notify-admin` and `/api/orders/:token/notify-payment`.

## Notes

- In-memory dedupe protects against short-term duplicate delivery in a single process.
- For multi-instance or long replay windows, use shared persistent storage for dedupe keys.
