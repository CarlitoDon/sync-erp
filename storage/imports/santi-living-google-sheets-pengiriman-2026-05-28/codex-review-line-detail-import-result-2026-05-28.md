# Rental Sheet Import - review-line-detail - 2026-05-28

Mode: apply
Company: Santi Living (f023d223-f787-4007-9660-1bfa155c6ec4)
Source folder: /Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-google-sheets-pengiriman-2026-05-28

## Scope
- Target order IDs: ORD-003, ORD-004, ORD-006
- Target count: 3
- Target total: Rp785.000
- Scope note: Reviewed daftar_pesanan rows with valid order totals; item line split is allocated from source subtotal and preserved in notes.
- Rows outside this batch were not mutated by this run.
- Existing likely matches and WhatsApp imports were not duplicated.

## Bundle Actions
- PKG-SINGLE-100: reuse (d96e5cec-3a69-4bb6-8b40-8429676e93d1)
- PKG-DOUBLE-120: reuse (aaa6e786-891a-4071-b9a1-94b3b2946c7a)
- PKG-QUEEN-160: reuse (eb015eaf-12d0-49cb-a0ca-27c5aa9e1d09)

## Orders
- Created: 0
- Would create: 0
- Existing/reused: 3
- Target exact total: Rp785.000

## Verification
- Readback scoped count: 3
- Readback scoped total: Rp785.000
- Missing order IDs: -
- Duplicate order IDs: -
- Status counts: {"DRAFT":3}

## Notes
- Orders are created as DRAFT/PENDING only; no payment settlement was posted in this step.
- Every imported line uses source CSV lineTotal so historical package prices are preserved.
- Net delivery fee is posted to deliveryFee; billed delivery fee and delivery discount are retained in notes.
