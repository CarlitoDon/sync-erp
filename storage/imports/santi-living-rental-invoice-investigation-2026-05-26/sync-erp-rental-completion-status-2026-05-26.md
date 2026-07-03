# Sync ERP Rental Completion Status - 2026-05-26

Company: Santi Living (`f023d223-f787-4007-9660-1bfa155c6ec4`)

## Current ERP State

- Imported rental orders: 26
- Imported total: Rp8.811.000
- Status: 26 `DRAFT`
- Payment status: 26 `PENDING`
- Duplicate `SL-INV-*` refs: none
- Held source refs:
  - `SL-INV-022`, `SL-INV-023`, `SL-INV-024`: duplicate forwarded rows in `masku purunku`
  - `SL-INV-029`: superseded by `SL-INV-028`

The imported orders are intentionally operational drafts. They are not confirmed, settled, posted as revenue, or marked paid yet.

## Implemented App/MCP Improvements

- MCP `rental_order_list` compact mode can read back rental orders without overloading agent context.
- MCP tool `rental_order_settle_historical_completed` exists for backdated historical settlement.
- API mutation `rental.orders.settleHistoricalCompleted` exists for completed historical rentals.
- Historical settlement guard blocks:
  - future payment/completion dates
  - future rental periods
  - cancelled orders
  - duplicate settlement where a return already exists
- Rental return journal can now receive a historical business date.
- Zero-deposit historical settlement no longer creates a zero-value deposit liability journal line.
- Rental availability is now date-aware: it counts physical units and subtracts only overlapping confirmed/active assignments for the requested date range.

## Carla Delegation

Carla was delegated a read-only settlement preflight through Hermes profile `carla`.

- Hermes session: `20260526_214312_866165`
- Correct conclusion: do not historical-settle yet without payment evidence or an explicit accounting policy.
- Note: Carla's bucket count in that preflight was not used as source of truth. The deterministic readback below is the accepted count.
- Handoff session after this runbook was created: `20260526_214806_9294c1`. Carla acknowledged the read-only boundary and the rule that settlement must wait for payment evidence or explicit approval.

## Deterministic Settlement Buckets

Cutoff: `2026-05-26 00:00 Asia/Jakarta`.

Finished-past orders:

- Count: 15
- Total: Rp3.614.000
- Refs: `SL-INV-007`, `SL-INV-011`, `SL-INV-012`, `SL-INV-013`, `SL-INV-014`, `SL-INV-015`, `SL-INV-016`, `SL-INV-017`, `SL-INV-018`, `SL-INV-020`, `SL-INV-021`, `SL-INV-025`, `SL-INV-026`, `SL-INV-027`, `SL-INV-028`

Current-or-future orders:

- Count: 11
- Total: Rp5.197.000
- Refs: `SL-INV-001`, `SL-INV-002`, `SL-INV-003`, `SL-INV-004`, `SL-INV-005`, `SL-INV-006`, `SL-INV-008`, `SL-INV-009`, `SL-INV-010`, `SL-INV-019`, `SL-INV-030`

## Settlement Policy Gate

Do not post revenue or mark payment as confirmed yet unless one of these is true:

1. There is payment evidence for each target order, with payment date and amount.
2. The owner explicitly approves the policy `invoice closing = paid/completed`.

If neither is true, the correct ERP state remains `DRAFT/PENDING`.

When approved, only the 15 finished-past refs above are candidates for historical settlement. Current/future refs must remain open unless their rental period has ended and payment evidence exists.

## Carla Execution Runbook After Approval

Use interactive Hermes `/goal`, not `-q`, for mutating work:

```bash
hermes --profile carla chat --verbose
/goal Sync ERP Santi Living rental settlement. Company exact "Santi Living". Use sync-erp MCP only. First read rental_order_list compact=true notesContains="SL-INV-" take=100 and confirm no duplicates. Only process approved refs from this runbook. Do not touch current/future orders. For each approved finished-past ref, call rental_order_settle_historical_completed with the real paymentDate/completedAt/evidence reference. Stop on first MCP error. Report IDs and reconciliation after each ref.
```

Required post-checks:

- `rental_order_list compact=true notesContains="SL-INV-" take=100`
- No duplicate `SL-INV-*` refs
- Finished-past settled refs have expected completed/paid state
- Current/future refs remain open
- Revenue/payment totals equal the approved settlement CSV exactly

## Verification Completed

- Root typecheck passed.
- API build passed.
- MCP typecheck and build passed.
- API lint passed with only pre-existing `email.service.ts` `no-console` warnings.
- Productization guard passed.
- Docker MCP services `mcp-sync-erp-upstream`, `mcp-sync-erp`, and `mcp-sync-erp-readonly` are healthy.
- Readonly MCP tool list includes `rental_order_settle_historical_completed`.
- Future-order settlement guard was smoke-tested and rejected `SL-INV-005` without mutating it.
- Readonly MCP availability check returned available unit counts for the requested historical/future range, proving the date-aware availability path is reachable.
