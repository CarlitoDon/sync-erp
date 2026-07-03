# Carla Validation Report — Santi Living Pengiriman Mapping
**Date:** 2026-05-28
**Scope:** Read-only validation of codex mapping files against Sync ERP (company: Santi Living, id: f023d223)
**Verdict:** PASS_WITH_NOTES

---

## 1. Mapping Status Counts

| Status | Count |
|---|---|
| needs_import_from_sheet | 34 |
| already_imported_exact | 18 |
| already_imported_needs_reference_link | 5 |
| schedule_only_or_future | 6 |
| **TOTAL** | **63** |

- ORD-008 is missing from mapping (confirmed absent in source sheet `DATA Pengiriman - ORD` tab per audit).
- ORD-059..ORD-064 are schedule-only / future placeholders with no data — correct behavior.
- Total ORD range: ORD-001 to ORD-064, 63 present, 1 missing. Coverage is acceptable.

---

## 2. Proposed Import Batch Safety

- **34 orders** in `codex-proposed-next-import-batch.csv`, all with `mapping_status = needs_import_from_sheet`.
- **Total proposed revenue:** Rp 14,871,000 (sum of `total_idr` across 34 rows).
- **Settlement status from mapping:** 9 orders have `sheet_settled = true` (ORD-001..007, ORD-009..011, all Jan–Mar 2026). The remaining 25 have `sheet_settled = false` but `remaining_idr = 0`, meaning the sheet shows zero balance but the "settled" flag was not explicitly set.
- **Note:** The proposed batch CSV does not carry the `sheet_settled` column. Recommend adding it before ERP write so Carla can distinguish fully-paid orders from those needing payment follow-up.
- **Item naming evolution:** Early orders use "Kasur 90x200" / "Paket 90x200"; later orders use "PAKET Single 90 → 1 pcs" / "PAKET Queen 160 → 2 pcs". Product mapping to ERP rental items (SKU: RGE-90-BIRU, RGE-100-BIRU, RGE-120-BIRU, RGE-160-BIRU, BANTAL-*, GULING-*) will be needed at import time. Current ERP daily rates: 30000 (90), 35000 (100), 40000 (120), 50000 (160), 10000 (accessories).
- **No blocking safety issue found.** All 34 orders have valid dates, customer names, items, and totals. Safe to proceed after user approval.

---

## 3. Already-Imported Exact Matches (18 orders)

All 18 have `invoice_action = post_draft_order` and `sync_erp_status = DRAFT`. The referenced ERP order numbers (RNT-202605-00001 through RNT-202605-00024) were confirmed in the mapping. No total or date mismatches in this group. Name variations are minor:

| ORD | Sheet Customer | Invoice Customer | Notes |
|---|---|---|---|
| ORD-041 | Salsaa | Salsa | 1-char typo, flagged exact |
| ORD-044 | Andhi | Andhi Setiadhi | Short vs full name |
| ORD-054 | Supriyanto | An Supriyanto | Prefix difference |

These are cosmetic; the ERP already holds the correct customer records.

---

## 4. Already-Imported Needs Reference Link (5 orders) — MISMATCHES

These are the key items requiring human review before any ERP edit:

| ORD | Customer | Issue | Sheet Value | Invoice/ERP Value |
|---|---|---|---|---|
| ORD-048 | Wahida | Total IDR mismatch | Rp 390,000 | Rp 300,000 |
| ORD-049 | Helena | Total IDR + end date mismatch | Rp 295,000 / 2026-05-25 | Rp 369,000 / 2026-05-27 |
| ORD-051 | Meilina | End date mismatch | 2026-05-26 | 2026-05-27 |
| ORD-052 | Meilina | End date mismatch | 2026-05-26 | 2026-05-27 |
| ORD-058 | Oni | Total IDR mismatch + 0 shipment events | Rp 220,000 | Rp 315,000 |

**Assessment:**
- ORD-048: Sheet is Rp 90k higher than invoice. Possible extras (add-ons, tips, penalties) not in invoice, or invoice was partial. Needs source verification.
- ORD-049: Invoice is Rp 74k higher AND ends 2 days later. Likely a late-return fee or extension was added to the WhatsApp invoice but not in the sheet. Needs reconciliation.
- ORD-051/052: Both Meilina orders have sheet end = May 26, invoice end = May 27. 1-day discrepancy — likely a pickup scheduling difference. Low risk but should confirm which date is authoritative.
- ORD-058: Sheet is Rp 95k LOWER than invoice, AND zero shipment events recorded. This is the most suspicious entry — either the sheet row is incomplete or the invoice covers additional items/fees. Needs manual verification.

---

## 5. Unmatched Operational Rows (5 main pengiriman rows)

These are `🚚 Pengiriman` rows that could not be linked to any ORD-* ID:

| Row | Customer | Dates | Total (Rp) | Nature |
|---|---|---|---|---|
| 13 | Feris (extend p) | 2026-03-25 → 2026-03-26 | 239,000 | Extension of ORD-016 Feris |
| 14 | Feris (extend p) | 2026-03-26 → 2026-03-27 | 131,000 | Extension of ORD-016 Feris |
| 16 | Yani (extend p) | 2026-03-24 → 2026-03-25 | 80,000 | Extension of ORD-011 Yani Andari |
| 59 | Bayu | 2026-05-28 → 2026-06-01 | 205,000 | New order, not yet in ORD spine |
| 68 | Abdillah Anwar | 2026-06-05 → 2026-06-06 | 810,000 | New order, not yet in ORD spine |

**Assessment:**
- Feris extensions (rows 13, 14) and Yani extension (row 16) are late-return fee rows tied to existing orders. They should be handled as rental return invoices with late fees, not as new orders.
- Bayu (row 59) and Abdillah Anwar (row 68) are future/new orders not yet in the ORD spine. They are in the sheet's operational tab but not in `Daftar Pesanan`. No import action needed now; they will naturally get ORD IDs when the sheet is updated.

---

## 6. Unmatched Imported Invoices (3 invoices)

| Invoice | Customer | Dates | Total (Rp) | ERP Order |
|---|---|---|---|---|
| SL-INV-005 | Evi | 2026-08-01 → 2026-08-03 | 482,000 | RNT-202605-00026 |
| SL-INV-011 | Gissa | 2026-05-15 → 2026-05-17 | 150,000 | RNT-202605-00010 |
| SL-INV-019 | Abdillah Anwar | 2026-06-05 → 2026-06-06 | 810,000 | RNT-202605-00025 |

**Assessment:**
- Evi (SL-INV-005): Future date (Aug 2026), not yet in sheet. Expected — will appear in a future sheet update.
- Gissa (SL-INV-011): May 15–17, 2026. This period is covered by the sheet (ORD-040..047 range) but Gissa does not appear. Possible WhatsApp-only order not logged in the sheet.
- **Abdillah Anwar (SL-INV-019):** This matches `unmatched_main_pengiriman` row 68 (same customer, same dates, same Rp 810,000). **These should be linked.** The imported invoice (RNT-202605-00025) and the operational row 68 are the same order. Recommend creating an ORD reference for row 68 and linking it to RNT-202605-00025.

---

## 7. Key Corrections / Actions

1. **[HIGH] Link Abdillah Anwar:** unmatched_imported_invoice SL-INV-019 (RNT-202605-00025) and unmatched_main_pengiriman row 68 are the same order. Assign an ORD ID and reconcile.
2. **[MED] Verify ORD-058 (Oni):** Sheet Rp 220k vs invoice Rp 315k, zero shipment events. Most suspicious mismatch — needs manual check against WhatsApp source.
3. **[MED] Reconcile ORD-048 (Wahida) and ORD-049 (Helena):** Total amount differences of Rp 90k and Rp 74k respectively. Confirm which source is authoritative.
4. **[LOW] Confirm Meilina end dates (ORD-051, ORD-052):** 1-day sheet vs invoice discrepancy. Pick authoritative date.
5. **[LOW] Add `sheet_settled` column to proposed batch CSV** so import logic can handle payment status correctly.
6. **[INFO] ORD-008 missing** from source sheet ORD tab — known gap, no action needed unless the order existed.

---

## 8. ERP Cross-Reference Summary

- Company: Santi Living (f023d223-f787-4007-9660-1bfa155c6ec4)
- Business shape: RENTAL
- Existing rental items: 8 (RGE-90, RGE-100, RGE-120, RGE-160, BANTAL-SPRINGBACK, BANTAL-COMFY, BANTAL-ROYAL-KING, GULING-COMFY)
- Existing invoices: 0 (invoice_list returned empty — invoices are likely embedded in rental orders or not yet posted)
- Rental orders in ERP: 100+ (list returned full page)
- All 18 already_imported orders are in DRAFT status with matching UUIDs confirmed in mapping

---

**Verdict: PASS_WITH_NOTES** — Mapping structure is sound, proposed import batch is safe for 34 orders after user approval. The 5 reference-link mismatches and the Abdillah Anwar dual-unmatch need human decision before finalizing.
