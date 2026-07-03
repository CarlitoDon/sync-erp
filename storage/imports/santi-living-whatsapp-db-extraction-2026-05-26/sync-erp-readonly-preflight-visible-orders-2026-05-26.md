# Sync ERP Readonly Preflight - Visible WhatsApp Orders

Generated: 2026-05-26 23:45 WIB

## Scope

- Source ledger: `validated-visible-order-ledger-for-sync-erp.csv` (18 visible-scope WhatsApp invoice rows).
- Sync ERP evidence came from Carla read-only MCP calls. Carla was interrupted after the read-only fetch because it started over-analyzing; no Sync ERP mutations were performed.
- Target company found: `Santi Living` (`f023d223-f787-4007-9660-1bfa155c6ec4`).

## Result

- Ledger rows checked: 18 totaling Rp6.751.000.
- Existing Sync ERP rental orders fetched: 26 totaling Rp8.811.000.
- Existing orders from import batch `santi-living-rental-invoice-investigation-2026-05-26`: 26.
- Visible ledger rows with existing ERP matches: 18/18.
- Rows held from create/posting because an order already exists: 18/18.
- Existing matched orders are currently `DRAFT` and `PENDING` payment, so they are not yet settled/confirmed operationally.

## Go / No-Go

**NO-GO for creating these 18 orders again.** They already match existing Sync ERP rental orders by customer/date/total. The safe next action is to verify/update the existing DRAFT orders and then decide confirmation/payment/settlement flow, not re-import.

## Row Summary

| Customer | Total | Existing Order | Status | Payment | Checks | Action |
|---|---:|---|---|---|---|---|
| Bu Pujo | Rp94.000 | RNT-202605-00016 (SL-INV-007) | DRAFT | PENDING | date=yes, total=yes, dp=yes, sisa=yes | HOLD |
| Meilina | Rp430.000 | RNT-202605-00017 (SL-INV-004) | DRAFT | PENDING | date=yes, total=yes, dp=yes, sisa=yes | HOLD |
| Oni | Rp315.000 | RNT-202605-00022 (SL-INV-001) | DRAFT | PENDING | date=yes, total=yes, dp=yes, sisa=yes | HOLD |
| Helena | Rp369.000 | RNT-202605-00014 (SL-INV-006) | DRAFT | PENDING | date=yes, total=yes, dp=yes, sisa=yes | HOLD |
| An Supriyanto | Rp355.000 | RNT-202605-00019 (SL-INV-010) | DRAFT | PENDING | date=yes, total=yes, dp=yes, sisa=yes | HOLD |
| Retno | Rp745.000 | RNT-202605-00020 (SL-INV-030) | DRAFT | PENDING | date=yes, total=yes, dp=yes, sisa=yes | HOLD |
| Wahida | Rp300.000 | RNT-202605-00015 (SL-INV-016) | DRAFT | PENDING | date=yes, total=yes, dp=yes, sisa=yes | HOLD |
| Tri Widh | Rp430.000 | RNT-202605-00023 (SL-INV-003) | DRAFT | PENDING | date=yes, total=yes, dp=yes, sisa=yes | HOLD |
| Evi | Rp482.000 | RNT-202605-00026 (SL-INV-005) | DRAFT | PENDING | date=yes, total=yes, dp=yes, sisa=yes | HOLD |
| M. Lutfi | Rp196.000 | RNT-202605-00021 (SL-INV-008) | DRAFT | PENDING | date=yes, total=yes, dp=yes, sisa=yes | HOLD |
| Hernawan | Rp186.000 | RNT-202605-00013 (SL-INV-012) | DRAFT | PENDING | date=yes, total=yes, dp=yes, sisa=yes | HOLD |
| Salsa | Rp375.000 | RNT-202605-00009 (SL-INV-027) | DRAFT | PENDING | date=yes, total=yes, dp=yes, sisa=yes | HOLD |
| Wening | Rp200.000 | RNT-202605-00007 (SL-INV-017) | DRAFT | PENDING | date=yes, total=yes, dp=yes, sisa=yes | HOLD |
| Gissa | Rp150.000 | RNT-202605-00010 (SL-INV-011) | DRAFT | PENDING | date=yes, total=yes, dp=yes, sisa=yes | HOLD |
| Andhi Setiadhi | Rp90.000 | RNT-202605-00006 (SL-INV-013) | DRAFT | PENDING | date=yes, total=yes, dp=both_missing, sisa=both_missing | HOLD |
| Uwie | Rp90.000 | RNT-202605-00011 (SL-INV-014) | DRAFT | PENDING | date=yes, total=yes, dp=yes, sisa=yes | HOLD |
| Alex | Rp1.134.000 | RNT-202605-00002 (SL-INV-026) | DRAFT | PENDING | date=yes, total=yes, dp=yes, sisa=yes | HOLD |
| Abdillah Anwar | Rp810.000 | RNT-202605-00025 (SL-INV-019) | DRAFT | PENDING | date=yes, total=yes, dp=yes, sisa=yes | HOLD |

## Extra Existing Orders Not In The 18-Row Visible Ledger

These came back from the same ERP import batch but are outside the current deduped visible ledger, so they need a separate source/evidence pass before operational confirmation.

| Order | Customer | Dates WIB | Total | Invoice Ref |
|---|---|---|---:|---|
| RNT-202605-00024 | Andi | 2026-05-30 to 2026-06-01 | Rp965.000 | SL-INV-009 |
| RNT-202605-00018 | Meilina | 2026-05-25 to 2026-05-27 | Rp100.000 | SL-INV-002 |
| RNT-202605-00012 | Taufik | 2026-05-16 to 2026-05-17 | Rp235.000 | SL-INV-015 |
| RNT-202605-00008 | Nita | 2026-05-14 to 2026-05-17 | Rp135.000 | SL-INV-018 |
| RNT-202605-00005 | Anik | 2026-05-13 to 2026-05-15 | Rp125.000 | SL-INV-021 |
| RNT-202605-00004 | Armyda | 2026-05-09 to 2026-05-10 | Rp105.000 | SL-INV-025 |
| RNT-202605-00003 | Adhitama | 2026-05-09 to 2026-05-10 | Rp185.000 | SL-INV-020 |
| RNT-202605-00001 | Intan Candra | 2026-05-01 to 2026-05-03 | Rp210.000 | SL-INV-028 |

## Gaps / Risks

- Andhi Setiadhi still has no DP/sisa in the WhatsApp invoice source or ERP note fields (`both_missing`); keep payment status unresolved until operator confirms.
- Meilina has one matching Rp430.000 order and one extra Rp100.000 ERP order in the same customer/time window; the Rp100.000 row needs separate evidence mapping before any confirmation.
- All matched orders are DRAFT/PENDING; creation happened, but completion/payment/settlement is not done.
- Discount/ongkir lines are captured in notes and totals, but should be verified before final posting because price and ongkir vary by invoice.

## Files

- CSV preflight: `sync-erp-readonly-preflight-visible-orders-2026-05-26.csv`
- This report: `sync-erp-readonly-preflight-visible-orders-2026-05-26.md`
- Read-only MCP result parsed from Hermes temp result `call_1842d996900845029ace49da.txt`.
