# Sync ERP Rental Order Import Result - 2026-05-26

Mode: apply
Company: Santi Living (f023d223-f787-4007-9660-1bfa155c6ec4)
Source folder: /Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-rental-invoice-investigation-2026-05-26

## Input Validation
- Postable invoices: 26
- Held invoices: 4
- Postable source total: Rp8.811.000
- Calculation mismatches: 0
- Missing postable partners: 0
- Variable ongkir policy: every invoice uses its own net deliveryFee from WhatsApp evidence.
- SL-INV-009: deliveryFee Rp55.000, discountAmount omitted because the Rp15.000 discount is already netted into ongkir.

## Bundles
- PKG-SINGLE-90: reuse (184df964-7614-409d-a143-a8e8bed78338)
- PKG-SINGLE-100: reuse (d96e5cec-3a69-4bb6-8b40-8429676e93d1)
- PKG-DOUBLE-120: reuse (aaa6e786-891a-4071-b9a1-94b3b2946c7a)
- PKG-QUEEN-160: reuse (eb015eaf-12d0-49cb-a0ca-27c5aa9e1d09)
- ADDON-BANTAL-UNTRACKED: reuse (85017930-5b8b-4fb5-ad88-7e24364a88cb)
- ADDON-SELIMUT-UNTRACKED: reuse (1bc73e2f-75fe-4e87-8dd5-a8e457f252e3)
- ADDON-SPREI-UNTRACKED: reuse (f2e12aaa-629e-4389-a2bd-ba0fc3920d00)
- ADDON-KIPAS-UNTRACKED: reuse (75d489d2-d518-4009-a31f-8d540b30965f)

## Orders
- Created: 26
- Reused/skipped existing: 0
- Would create: 0

## Verification
- Readback order count: 26
- Readback total: Rp8.811.000
- Missing refs: -
- Duplicate refs: -
- Status counts: {"DRAFT":26}

## Notes
- Orders are imported as DRAFT rental orders only. No confirmation, release, return, or payment verification was performed.
- Package and kasur-only prices are invoice-specific through line pricePerDay.
- Add-on bundles marked Untracked preserve invoice revenue without inferring unspecified stock brand from WhatsApp text.
