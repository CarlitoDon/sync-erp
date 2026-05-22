# Sync ERP Standalone + Santi Flow Tasks

## Phase 1 - Boundary Cleanup

- [x] Remove Santi-specific rollback from rental external order creation.
- [x] Replace hardcoded Santi integration marketplace default with a generic storefront integration.
- [x] Keep internal Sync ERP tRPC available.
- [x] Add dedicated external tRPC integration v1 router.
- [ ] Finish removing legacy Santi-specific references from old tests, docs, env examples, and deprecated compatibility code.

## Phase 2 - Dual API Transport

- [x] Add shared rental integration schemas.
- [x] Add REST `/api/v1` rental routes.
- [x] Add tRPC `/api/trpc/integration/v1` rental router.
- [x] Reuse rental integration service across REST and tRPC.
- [x] Document API v1 contract.
- [ ] Generate formal OpenAPI JSON from schemas.

## Phase 3 - Generic Webhooks

- [x] Route new integration order/payment events to generic tenant webhook events.
- [x] Stop starting the rental-specific webhook worker in the API runtime.
- [ ] Remove or migrate the remaining rental-specific webhook outbox admin/test surfaces.
- [ ] Add focused webhook signature/replay tests for API v1 events.

## Phase 4 - WA Connector

- [x] Add bot connector `verifyPhone` tRPC contract.
- [x] Move Santi phone preflight into Santi Proxy before ERP order creation.
- [x] Prevent late WA failures from deleting ERP orders.
- [ ] Extract the bot app into a separately owned connector package/repo.
- [ ] Add durable Santi notification outbox for WA retries.

## Phase 5 - Santi Customer Flow

- [x] Replace Santi ERP client with REST API v1 client.
- [x] Call `verifyPhone` before ERP order creation.
- [x] Create ERP order only after phone verification succeeds.
- [x] Send customer/admin order WA from Santi after ERP order creation.
- [x] Keep Midtrans flow in Santi and update Sync ERP payment state.
- [x] Send customer/admin payment WA from Santi after Midtrans events.

## Phase 6 - Tests

- [ ] Add Sync ERP REST API v1 integration tests.
- [ ] Add Sync ERP tRPC integration v1 tests.
- [ ] Add parity test for REST and tRPC domain responses.
- [ ] Add Santi tests for invalid phone preflight and bot unavailable flow.
- [ ] Run Sync ERP typecheck/lint/build.
- [ ] Run Santi proxy typecheck/lint/test.
