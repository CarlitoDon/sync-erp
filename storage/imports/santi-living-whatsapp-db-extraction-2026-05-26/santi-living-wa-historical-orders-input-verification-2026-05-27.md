# Santi Living WA Historical Rental Orders Input Verification - 2026-05-27

## Result

- Batch: santi-living-wa-historical-orders-2026-05-27
- Created/reused: 21/0
- SL-WA orders expected/found: 21/21
- SL-WA total expected/found: Rp7.671.000/Rp7.671.000
- SL-WA DP expected/found: Rp936.000/Rp936.000
- SL-WA remaining expected/found: Rp6.735.000/Rp6.735.000
- Combined SL-INV + SL-WA count expected/found: 48/48
- Combined SL-INV + SL-WA total expected/found: Rp16.687.000/Rp16.687.000
- Missing SL-WA refs: none
- Duplicate scoped refs: none

## Orders Input

| Ref | Order | Customer | Date | Total | DP | Remaining | Action |
|---|---|---|---|---:|---:|---:|---|
| SL-WA-001 | RNT-202605-00028 | Abdul Aziz Salimi | 2026-03-15 to 2026-03-17 | Rp128.000 | Rp0 | Rp128.000 | created |
| SL-WA-002 | RNT-202605-00029 | Abdul Aziz Salimi | 2026-03-19 to 2026-03-22 | Rp324.000 | Rp0 | Rp324.000 | created |
| SL-WA-003 | RNT-202605-00030 | Alfrida | 2026-03-23 to 2026-03-27 | Rp370.000 | Rp0 | Rp370.000 | created |
| SL-WA-004 | RNT-202605-00031 | Antoni | 2026-03-20 to 2026-03-24 | Rp804.000 | Rp0 | Rp804.000 | created |
| SL-WA-005 | RNT-202605-00032 | Aries Nandarika | 2026-04-03 to 2026-04-06 | Rp715.000 | Rp300.000 | Rp415.000 | created |
| SL-WA-006 | RNT-202605-00033 | Dzaky | 2026-03-26 to 2026-03-29 | Rp552.000 | Rp0 | Rp552.000 | created |
| SL-WA-007 | RNT-202605-00034 | Fendy | 2026-03-18 to 2026-03-25 | Rp642.000 | Rp0 | Rp642.000 | created |
| SL-WA-008 | RNT-202605-00035 | Fendy (Perpanjangan) | 2026-03-25 to 2026-03-28 | Rp264.000 | Rp0 | Rp264.000 | created |
| SL-WA-009 | RNT-202605-00036 | Felis / Ella | 2026-03-17 to 2026-03-23 | Rp644.000 | Rp300.000 | Rp344.000 | created |
| SL-WA-010 | RNT-202605-00037 | Lucky Enjang | 2026-03-17 to 2026-03-18 | Rp93.000 | Rp40.000 | Rp53.000 | created |
| SL-WA-011 | RNT-202605-00038 | Muji | 2026-03-24 to 2026-03-25 | Rp320.000 | Rp0 | Rp320.000 | created |
| SL-WA-012 | RNT-202605-00039 | Muji | 2026-03-25 to 2026-03-26 | Rp252.000 | Rp0 | Rp252.000 | created |
| SL-WA-013 | RNT-202605-00040 | Muji | 2026-03-26 to 2026-03-27 | Rp252.000 | Rp0 | Rp252.000 | created |
| SL-WA-014 | RNT-202605-00041 | Nisrina | 2026-03-19 to 2026-03-23 | Rp518.000 | Rp0 | Rp518.000 | created |
| SL-WA-015 | RNT-202605-00042 | Nawang | 2026-04-12 to 2026-04-13 | Rp60.000 | Rp20.000 | Rp40.000 | created |
| SL-WA-016 | RNT-202605-00043 | Nawang | 2026-04-12 to 2026-04-14 | Rp95.000 | Rp30.000 | Rp65.000 | created |
| SL-WA-017 | RNT-202605-00044 | Feris | 2026-03-23 to 2026-03-25 | Rp685.000 | Rp0 | Rp685.000 | created |
| SL-WA-018 | RNT-202605-00045 | Zami Fatih | 2026-04-06 to 2026-04-10 | Rp205.000 | Rp0 | Rp205.000 | created |
| SL-WA-019 | RNT-202605-00046 | Jhon BT | 2026-03-28 to 2026-03-30 | Rp183.000 | Rp75.000 | Rp108.000 | created |
| SL-WA-020 | RNT-202605-00047 | Harmawan | 2026-04-11 to 2026-04-12 | Rp145.000 | Rp45.000 | Rp100.000 | created |
| SL-WA-021 | RNT-202605-00048 | Aryadi | 2026-04-10 to 2026-04-12 | Rp420.000 | Rp126.000 | Rp294.000 | created |

## Not Posted To ERP Yet

- Agashi UNY: Order complete label, but Feb 2026 chat invoice is encrypted or unavailable in export.
- d@pi1e - Jakal KM9: Order complete label, but Feb 2026 chat invoice is encrypted or unavailable in export.
- Harza Arbaha Wates KP: Only KTP/payment-info context found; invoice details were not found.
- Intan Griya Alvita: Only thank-you/contact context found; invoice details were not found.

## DB Readback

- Direct PostgreSQL scoped `SL-INV-*` + `SL-WA-*`: 48 orders, total Rp16.687.000, duplicate refs 0.
- Direct PostgreSQL scoped `SL-WA-*`: 21 orders, total Rp7.671.000, subtotal Rp7.091.000, ongkir Rp580.000, DP notes Rp936.000, remaining notes Rp6.735.000.
- `SL-WA-*` line subtotal equals order subtotal on all rows: mismatch 0.
- `SL-WA-*` rows without evidence_file note: 0.
- `SL-WA-*` rows accidentally dated 2026-05-27: 0.
- DB verification CSV: /Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-whatsapp-db-extraction-2026-05-26/santi-living-wa-historical-orders-db-verification-2026-05-27.csv

## Files

- Result JSON: /Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-whatsapp-db-extraction-2026-05-26/santi-living-wa-historical-orders-input-result-2026-05-27.json
- Result ledger: /Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-whatsapp-db-extraction-2026-05-26/santi-living-wa-historical-orders-input-ledger-2026-05-27.csv
- Evidence file: /Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-whatsapp-db-extraction-2026-05-26/carla-state-invoice-evidence-raw-2026-05-27.txt
