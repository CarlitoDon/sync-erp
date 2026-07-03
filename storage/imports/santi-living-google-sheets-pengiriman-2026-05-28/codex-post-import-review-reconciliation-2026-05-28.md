# Post Import Review Reconciliation - 2026-05-28

Company: Santi Living
Source: Google Sheet pengiriman export + Sync ERP read-back

## Current Sync ERP State
- Rental orders in company: 66
- Total rental order amount: Rp24.042.000
- Status: 66 DRAFT
- Payment status: 66 PENDING
- Rental extensions recorded: 4

## Import Executed
- Clean unmatched batch: 11 orders, Rp4.338.000, read back as existing after idempotent rerun.
- Review-line-detail batch: 3 orders, Rp785.000, created as RNT-202605-00062 through RNT-202605-00064.
- Source-conflict-resolved batch: 2 orders, Rp463.000, read back as RNT-202605-00065 through RNT-202605-00066.
- Total sheet orders imported by Codex script: 16 orders, Rp5.586.000.
- All created lines use source lineTotal or explicit Pengiriman-sheet deltas; historical price is not inferred from SKU or current package defaults.

## Full Extension Rule
- Full extension means the same rented item stays with the customer longer; there is no extra delivery/pickup fee line.
- ORD-020 was corrected from Rp313.000 to Rp295.000 by removing Rp18.000 that had been treated as extension delivery fee.
- Partial extension can still carry a separate delivery fee when the source invoice/evidence shows an actual extra delivery/pickup charge.

## Review Row Resolution
| Order | Resolution | ERP order | Amount basis | Note |
|---|---|---:|---:|---|
| ORD-003 | created_from_review_line_detail | RNT-202605-00062 | source 300000, ERP 300000 | created via MCP; line split allocated by source subtotal; Adani; packages 160+100; delivery net 30000 |
| ORD-004 | created_from_review_line_detail | RNT-202605-00063 | source 375000, ERP 375000 | created via MCP; line split allocated by source subtotal; Harza; packages 120+160; delivery 65000 |
| ORD-006 | created_from_review_line_detail | RNT-202605-00064 | source 110000, ERP 110000 | created via MCP; line split allocated by source subtotal; Vivi; package 160 + GULING-COMFY addon; delivery net 31000 |
| ORD-011 | already_represented_no_duplicate | RNT-202605-00050 | source 1206000 + extension 80000, ERP 1286000 | existing corrected order; main row 1342000 includes non-invoiced tip per note; Yani Andari / dony; no new ERP order |
| ORD-013 | created_from_source_conflict_resolved | RNT-202605-00065 | source main 168000, ERP 168000 | created via MCP using Pengiriman operational sheet total; Intan; package 120 subtotal 147000 + delivery delta 21000 |
| ORD-014 | already_represented_split_no_duplicate | RNT-202605-00034 + RNT-202605-00035 | source 880000 vs main 906000, ERP 906000 | existing split orders match total including delivery/perpanjangan; Fendy base 642000 + extension/order 264000 |
| ORD-015 | already_represented_no_duplicate | RNT-202605-00031 | source 784000 vs main 804000, ERP 804000 | existing WhatsApp invoice includes delivery 20000; Antoni; no new ERP order |
| ORD-016 | already_represented_with_extensions | RNT-202605-00044 | source 638000 base / 665000 with delivery, ERP 1055000 | existing order has base invoice plus two extension records and extension delivery fees; Feris base 685000 + ext 239000 + ext 131000 |
| ORD-018 | already_represented_no_duplicate | RNT-202605-00030 | source 348000 vs main 370000, ERP 370000 | existing WhatsApp invoice includes delivery 22000; Alfrida; no new ERP order |
| ORD-019 | already_represented_no_duplicate | RNT-202605-00033 | source 531000 vs main 552000, ERP 552000 | existing WhatsApp invoice includes delivery 21000; Dzaky; no new ERP order |
| ORD-020 | created_from_source_conflict_resolved_with_full_extension | RNT-202605-00066 | source raw main 313000; corrected full-extension basis 295000, ERP 295000 | corrected after user rule: full extension has no extra delivery fee; Eksperian; base 24-26 Rp118000, full extension to 29 Mar item Rp177000, extension delivery Rp0; removed Rp18000 |

## Held Rows
- None for the 11 review rows. Two previous conflicts were resolved from the Pengiriman operational sheet, with ORD-020 corrected to the full-extension no-delivery-fee rule.

## Verification Rules Applied
- No duplicate order was created for rows already represented by WhatsApp/ERP records.
- Review-line-detail rows were imported only after dry-run confirmed no duplicate and exact total match.
- Source-conflict rows were imported only where Pengiriman operational sheet explained the delta as delivery fee or actual pickup extension.
- ORD-020 uses the generic per-item historical extension feature, with delivery fee set to Rp0 because it is a full extension.
