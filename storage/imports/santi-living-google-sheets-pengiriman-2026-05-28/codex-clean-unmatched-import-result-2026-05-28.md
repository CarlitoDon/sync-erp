# Rental Sheet Import - clean-unmatched - 2026-05-28

Mode: apply
Company: Santi Living (f023d223-f787-4007-9660-1bfa155c6ec4)
Source folder: /Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-google-sheets-pengiriman-2026-05-28

## Scope
- Target order IDs: ORD-001, ORD-002, ORD-007, ORD-023, ORD-026, ORD-027, ORD-029, ORD-032, ORD-033, ORD-034, ORD-039
- Target count: 11
- Target total: Rp4.338.000
- Scope note: Clean unmatched Google Sheet rows with exact line totals and no conflicting existing ERP order.
- Rows outside this batch were not mutated by this run.
- Existing likely matches and WhatsApp imports were not duplicated.

## Bundle Actions
- PKG-SINGLE-90: reuse (184df964-7614-409d-a143-a8e8bed78338)
- PKG-SINGLE-100: reuse (d96e5cec-3a69-4bb6-8b40-8429676e93d1)
- PKG-DOUBLE-120: reuse (aaa6e786-891a-4071-b9a1-94b3b2946c7a)
- PKG-QUEEN-160: reuse (eb015eaf-12d0-49cb-a0ca-27c5aa9e1d09)
- ADDON-SELIMUT-UNTRACKED: reuse (1bc73e2f-75fe-4e87-8dd5-a8e457f252e3)

## Orders
- Created: 0
- Would create: 0
- Existing/reused: 11
- Target exact total: Rp4.338.000

## Verification
- Readback scoped count: 11
- Readback scoped total: Rp4.338.000
- Missing order IDs: -
- Duplicate order IDs: -
- Status counts: {"DRAFT":11}

## Notes
- Orders are created as DRAFT/PENDING only; no payment settlement was posted in this step.
- Every imported line uses source CSV lineTotal so historical package prices are preserved.
- Net delivery fee is posted to deliveryFee; billed delivery fee and delivery discount are retained in notes.
