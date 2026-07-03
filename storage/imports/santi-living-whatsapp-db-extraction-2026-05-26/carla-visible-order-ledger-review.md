# Carla Visible Order Ledger Review

Generated: 2026-05-26 (Carla preflight, read-only)

Codex validation update: parser was corrected after this review to capture non-standard `DP : Rp...` formatting. The corrected source and CSV now capture Alex DP Rp340.000 and sisa Rp794.000. The authoritative handoff file is `validated-visible-order-ledger-for-sync-erp.csv`.

## Scope

Source: WhatsApp Web extraction artifacts from Chrome Profile 1 / Santi Living.
Input files analyzed:
- `visible-chat-invoice-candidates-deduped.csv` (18 deduped rows)
- `browser-visible-chat-extraction-manifest.csv` (60 opened chats)
- `visible-chat-extraction-report.md`
- `visible-chat-texts/` (50 chat text files)

This is a candidate ledger only. No Sync ERP records were read, created, or modified.

---

## Counts

| Metric | Count |
|---|---:|
| Total sidebar rows visible at extraction | 76 |
| Chats opened via CUA | 60 |
| Chats with invoice text found | 18 |
| Non-invoice chats (lead/enquiry/other) | 42 |
| Deduped invoice candidate rows | **18** |

## Totals (IDR)

| Metric | Amount |
|---|---:|
| Sum of total_idr (all 18 rows) | **Rp6.751.000** |
| Sum of dp_idr (17 rows with DP) | Rp1.997.000 |
| Sum of sisa_idr (17 rows with sisa) | Rp4.664.000 |
| Rows missing DP/sisa data | 1 (Andhi Setiadhi Rp90.000) |

### Breakdown by Customer

| Customer | Send Date | Total (IDR) | DP (IDR) | Sisa (IDR) |
|---|---|---:|---:|---:|
| Bu Pujo | 21 Mei 2026 | 94.000 | 28.000 | 66.000 |
| Meilina | 23 Mei 2026 | 430.000 | 129.000 | 301.000 |
| Oni | 30 Mei 2026 | 315.000 | 95.000 | 220.000 |
| Helena | 20 Mei 2026 | 369.000 | 111.000 | 258.000 |
| An Supriyanto | 26 Mei 2026 | 355.000 | 107.000 | 248.000 |
| Retno | 26 Mei 2026 | 745.000 | 220.000 | 525.000 |
| Wahida | 20 Mei 2026 | 300.000 | 90.000 | 210.000 |
| Tri Widh | 30 Mei 2026 | 430.000 | 129.000 | 301.000 |
| Evi | 1 Agt 2026 | 482.000 | 145.000 | 337.000 |
| M. Lutfi | 29 Mei 2026 | 196.000 | 59.000 | 137.000 |
| Hernawan | 17 Mei 2026 | 186.000 | 56.000 | 130.000 |
| Salsa | 14 Mei 2026 | 375.000 | 113.000 | 262.000 |
| Wening | 14 Mei 2026 | 200.000 | 60.000 | 140.000 |
| Gissa | 15 Mei 2026 | 150.000 | 45.000 | 105.000 |
| Andhi Setiadhi | 14 Mei 2026 | 90.000 | — | — |
| Uwie | 15 Mei 2026 | 90.000 | 27.000 | 63.000 |
| Alex | 7 Mei 2026 | 1.134.000 | 340.000 | 794.000 |
| Abdillah Anwar | 5 Jun 2026 | 810.000 | 243.000 | 567.000 |

---

## Duplicate / Revision Handling

- **Total invoice occurrences before dedup**: 23
- **Deduped to**: 18 unique rows
- **Revisions flagged**: 1
  - `Abdillah Anwar` — source file `056-cust-sl-abdillah-ngestiharjo.txt`, `invoice_occurrence=2`, `is_revision=True`. Invoice text header says "INVOICE PEMESANAN (REVISI)". The revision row is kept as the latest version; the original occurrence was superseded.
- **Multi-occurrence chats (not revisions)**: 3
  - `Tri Widh` (invoice_occurrence=2) — first and second occurrence have identical content; second kept.
  - `M. Lutfi` (invoice_occurrence=2) — identical content; second kept.
  - `Andhi Setiadhi` (invoice_occurrence=2) — identical content; second kept.

---

## Future-Dated Orders

Today is 26 Mei 2026. The following orders have send dates after today:

| Customer | Send Date | Total (IDR) | Status Flag |
|---|---|---:|---|
| Oni | 30 Mei 2026 | 315.000 | future_dated |
| Tri Widh | 30 Mei 2026 | 430.000 | future_dated |
| M. Lutfi | 29 Mei 2026 | 196.000 | future_dated |
| Evi | 1 Agt 2026 | 482.000 | future_dated_farfetched |
| Abdillah Anwar | 5 Jun 2026 | 810.000 | future_dated |

- **Evi** (Agustus 2026) is ~2+ months out — likely a pre-order or quote. Verify with customer before ERP posting.
- **Oni, Tri Widh, M. Lutfi, Abdillah Anwar** are near-future (late May / early June). These are plausible confirmed orders with DP collected.

---

## Past / Completed Orders

Orders with send dates before today (26 Mei 2026) and return dates that have already passed:

| Customer | Send Date | Return Date | Total (IDR) | Likely Status |
|---|---|---|---:|---|
| Bu Pujo | 21 Mei | 22 Mei | 94.000 | completed |
| Helena | 20 Mei | 27 Mei | 369.000 | active or completed today |
| Wahida | 20 Mei | 23 Mei | 300.000 | completed |
| Hernawan | 17 Mei | 18 Mei | 186.000 | completed |
| Salsa | 14 Mei | 17 Mei | 375.000 | completed |
| Wening | 14 Mei | 17 Mei | 200.000 | completed |
| Gissa | 15 Mei | 17 Mei | 150.000 | completed |
| Andhi Setiadhi | 14 Mei | 15 Mei | 90.000 | completed |
| Uwie | 15 Mei | 16 Mei | 90.000 | completed |
| Alex | 7 Mei | 9 Mei | 1.134.000 | completed |

- **Meilina** (23–27 Mei) — return date is tomorrow; currently active.
- **An Supriyanto** (26 Mei–1 Jun) — starts today; active.
- **Retno** (26–30 Mei) — starts today; active.

These 10+3 orders should use `settle_historical_completed` or equivalent backfill flow in Sync ERP, not a forward-looking rental order create.

---

## Risk Summary for ERP Posting

### HIGH RISK — Must resolve before posting

1. **No ERP preflight done.** This ledger was built purely from WhatsApp invoice text. No Sync ERP read was performed to check for existing rental orders, duplicate partner records, product/item mapping, or payment status. Posting blindly will create duplicates.

2. **DP data missing for 1 row.** Andhi Setiadhi (Rp90.000) has no DP/sisa breakdown in the invoice text. Alex is now captured from the invoice text as DP Rp340.000 and sisa Rp794.000 after the parser fix.

3. **Alex special pricing.** Alex received a 10% Google Maps review discount (-Rp126.000). The invoice subtotal is Rp1.230.000, ongkir Rp30.000, discount -Rp126.000, total Rp1.134.000. DP stated as Rp340.000 in text (not the standard 30%). This needs custom handling in ERP — standard 30% DP logic won't match.

4. **Item-to-product mapping not done.** WhatsApp invoice items like "Paket Queen 160", "Paket Single 90", "Add on Bantal", "Kipas Angin", "FREE SEWA 2 guling" need to map to Sync ERP rental items. No product catalog was consulted.

5. **Partner (customer) creation not done.** 18 customers need to exist as partners in Sync ERP. Some have locations (e.g., "Nogotirto", "Dekat UMY"), some have phone-only identifiers. No partner dedup check against existing ERP data.

### MEDIUM RISK

6. **Ongkir with Google Maps review discount.** 6 orders have ongkir reduced by Rp10.000 for Google Maps review. The raw ongkir values contain mixed formats: "Rp35.000 - Rp10.000 (review Google maps)" vs flat "Rp125.000". Net ongkir not pre-calculated.

7. **Free items.** Meilina has "FREE SEWA 2 guling" and "FREE SEWA 2 selimut". These are complimentary add-ons with Rp0 charge but should still be tracked as rental items for inventory availability.

8. **Date format inconsistency.** Most dates use "DD MMM YYYY" but Tri Widh and Evi use "Hari, DD MMM YYYY" format (e.g., "Sabtu, 30 Mei 2026"). Parsing handled but worth noting.

9. **Extraction scope limitation.** Only 60 of 76 visible sidebar chats were opened. The remaining 16 rows were not reached. Older chats beyond the sidebar are not covered at all. This ledger represents a partial window, not a complete customer history.

### LOW RISK

10. **Rental period units.** Most use "malam" (night) but Alex uses "hari" (day). This is a display-label difference, not a pricing logic difference, but should be normalized in ERP.

11. **WhatsApp chat opening as read.** Opening chats through WhatsApp Web marks unread chats as read. This is an irreversible side effect of the extraction method.

---

## Recommended Next Steps

1. Run Sync ERP `company_list` → identify target company for Santi Living.
2. Run `partner_list` → check which customers already exist.
3. Run `rental_item_list` → map WhatsApp item names to ERP rental item IDs.
4. Run `rental_order_list` → check for existing orders that may match these candidates.
5. For completed past orders: use `rental_order_create` + `settle_historical_completed` with appropriate `paymentDate`.
6. For active/future orders: use standard `rental_order_create` → `confirm` → `release` flow.
7. Resolve the remaining missing-DP row (Andhi Setiadhi) manually with the operator.
8. Process the Abdillah Anwar revision as the latest version only; do not post the original.

---

## Output Files

- **CSV**: `carla-visible-order-ledger-for-sync-erp.csv`
  - 18 rows, one per deduped invoice candidate
  - Columns: customer, source_file, send_date_text, return_date_text, duration_text, item_summary, ongkir_raw, total_idr, dp_idr, sisa_idr, evidence_status, erp_posting_status
- **Validated CSV**: `validated-visible-order-ledger-for-sync-erp.csv`
  - 18 rows regenerated from the corrected deduped source
  - Status remains `hold_for_erp_preflight` until Sync ERP duplicate/item/partner checks are done

- **This review**: `carla-visible-order-ledger-review.md`
