# Santi Living Rental Order Mapping Final Check - 2026-05-27

## Result

- Sync ERP rental orders checked: 26
- Sync ERP mapped to WhatsApp/Carla evidence: 26
- Sync ERP mapped total: Rp8.811.000
- Sync ERP recorded DP total: Rp2.588.000
- Sync ERP recorded remaining total: Rp6.033.000
- Current WhatsApp/Carla source invoices not yet in ERP: 1
- Current source-not-in-ERP total: Rp205.000
- Superseded invoice evidence excluded from current ledger: 1

## Current Source Not In ERP

| Customer | Location | Start | End | Total | DP | Remaining | Source |
|---|---|---:|---:|---:|---:|---:|---|
| Bayu | Vila Gardenia, Gunung Sempu | 2026-05-28 | 2026-06-01 | Rp205.000 | Rp62.000 | Rp143.000 | carla_telegram_whatsapp_extract |

## Superseded / Not Current

| Customer | Start | End | Total | Reason |
|---|---:|---:|---:|---|
| Intan Candra | 2026-05-01 | 2026-05-02 | Rp120.000 | superseded by current Intan Candra 2-night invoice Rp210.000 / SL-INV-028 |

## Notes

- The official current ERP set still has 26 draft rental orders totaling Rp8.811.000.
- Carla's Telegram session `20260527_093417_e20d22` explicitly found 27 WhatsApp invoices vs 26 ERP orders and identified Bayu as not in ERP.
- This report corrects that comparison by adding Retno from direct visible-chat extraction and excluding the older Intan Candra one-night invoice as superseded. On that basis, the current source universe is 27 orders totaling Rp9.016.000.
- Intan Candra needs DP review before payment posting: ERP note has `dp=63000`, but invoice text also says `Rp63.000 - Rp36.000 : Rp27.000`.
- This script did not mutate Sync ERP.

## Output Files

- `/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-whatsapp-db-extraction-2026-05-26/santi-living-rental-orders-final-current-ledger-2026-05-27.csv`
- `/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-whatsapp-db-extraction-2026-05-26/santi-living-rental-orders-source-not-in-erp-2026-05-27.csv`
