# Sync ERP Rental Order Import Runbook - Santi Living

Candidate source: `rental-invoices-extracted.csv`.

Postable draft orders: 26
Postable total: Rp8.811.000
Skipped/held rows: 4

## Posting Policy

- Create DRAFT rental orders only in this pass. Do not confirm or reserve units yet.
- Use exact invoice line `pricePerDay`; never infer from master rate.
- Use `deliveryFee` net of invoice ongkir discounts, and `discountAmount` for explicit invoice discount lines.
- `SL-INV-009`: use `deliveryFee=55000` and no `discountAmount`; the Rp15.000 discount is already netted into delivery fee.
- Preserve full invoice text in order notes.
- Dedupe forwarded `masku purunku` invoices and skip superseded Intan 2026-04-29 invoice.

## Required Bundle Master Setup

- `PKG-SINGLE-90` -> Paket Single 90, component RGE-90-BIRU x1, default dailyRate 35000.
- `PKG-SINGLE-100` -> Paket Single 100, component RGE-100-BIRU x1, default dailyRate 40000.
- `PKG-DOUBLE-120` -> Paket Double 120, component RGE-120-BIRU x1, default dailyRate 45000.
- `PKG-QUEEN-160` -> Paket Queen 160, component RGE-160-BIRU x1, default dailyRate 55000.
- `ADDON-BANTAL-UNTRACKED`, `ADDON-SELIMUT-UNTRACKED`, `ADDON-SPREI-UNTRACKED`, `ADDON-KIPAS-UNTRACKED` are no-component bundles used as invoice add-on revenue lines until physical stock is modeled.

## Held Rows

- SL-INV-022: skip_duplicate - same invoice also appears in customer chat; skip forwarded masku purunku row
- SL-INV-023: skip_duplicate - same invoice also appears in customer chat; skip forwarded masku purunku row
- SL-INV-024: skip_duplicate - same invoice also appears in customer chat; skip forwarded masku purunku row
- SL-INV-029: skip_superseded - Intan 2026-04-29 one-night invoice superseded by 2026-04-30 two-night invoice
