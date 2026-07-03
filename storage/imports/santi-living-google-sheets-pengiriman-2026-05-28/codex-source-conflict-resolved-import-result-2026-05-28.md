# Rental Sheet Import - source-conflict-resolved - 2026-05-28

Mode: apply
Company: Santi Living (f023d223-f787-4007-9660-1bfa155c6ec4)
Source folder: /Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-google-sheets-pengiriman-2026-05-28

## Scope
- Target order IDs: ORD-013, ORD-020
- Target count: 2
- Target total: Rp463.000
- Scope note: Resolved source conflicts using Pengiriman operational sheet: delivery fee delta for ORD-013 and full-item extension without extra delivery fee for ORD-020.
- Rows outside this batch were not mutated by this run.
- Existing likely matches and WhatsApp imports were not duplicated.

## Bundle Actions
- PKG-DOUBLE-120: reuse (aaa6e786-891a-4071-b9a1-94b3b2946c7a)
- PKG-QUEEN-160: reuse (eb015eaf-12d0-49cb-a0ca-27c5aa9e1d09)

## Orders
- Created: 0
- Would create: 0
- Existing/reused: 2
- Target exact total: Rp463.000

## Verification
- Readback scoped count: 2
- Readback scoped total: Rp463.000
- Missing order IDs: -
- Duplicate order IDs: -
- Status counts: {"DRAFT":2}

## Notes
- Orders are created as DRAFT/PENDING only; no payment settlement was posted in this step.
- Every imported line uses source CSV lineTotal so historical package prices are preserved.
- Net delivery fee is posted to deliveryFee; billed delivery fee and delivery discount are retained in notes.
