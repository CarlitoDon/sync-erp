# Carla Telegram Reports Reconciliation - 2026-05-27

## Scope
Read and reconciled all 8 files visible in Telegram `Hermes Carla` plus Carla's local `state.db` rows that produced the final report. The JPG is not usable content; the 7 PDFs and the later Carla state script are usable.

## Main Finding
The earlier conclusion that only 26-27 orders were available is superseded.

Carla's most complete local state says:

| Set | Count | Total | DP | Sisa |
|---|---:|---:|---:|---:|
| Carla ERP snapshot | 26 | Rp8.811.000 | Rp2.588.000 | Rp6.223.000 |
| Carla WhatsApp missing candidates | 21 | Rp7.671.000 | Rp936.000 | Rp6.735.000 |
| Carla final total | 47 | Rp16.482.000 | Rp3.524.000 | Rp12.958.000 |
| Current Sync ERP after Bayu fix | 27 | Rp9.016.000 | Rp2.650.000 | Rp6.176.000 recorded / Rp6.366.000 computed |
| Current Sync ERP + Carla WhatsApp candidates | 48 | Rp16.687.000 | Rp3.586.000 | Rp12.911.000 recorded / Rp13.101.000 computed |

Because Bayu was added after Carla's PDF snapshot, the practical current target is **48 orders** if all 21 WhatsApp candidate rows are accepted and entered into Sync ERP.

## Files Read

| File | What It Says | Reliability Note |
|---|---|---|
| `santi_living_orders_report.pdf` | 26 ERP orders, total Rp8.811.000 | Earlier ERP report; DP total differs from later/current ledger. |
| `santi_living_whatsapp_leads_closings.pdf` | 77 chats, 45 leads, 32 closing/customer, 26 nominal closings total Rp8.811.000 | Lead/closing summary, not enough for all historical orders. |
| `Laporan_Pesanan_Santi_Living.pdf` | 47 Order Complete labels, 27 leads, 7 Down Payment, 58 active | Label inventory. |
| `Laporan_Pesanan_Santi_Living_Lengkap.pdf` | 15 detailed invoice rows plus 31 complete rows without invoice details | Intermediate state. |
| `Laporan_Pesanan_Santi_Living_Lengkap_ERP.pdf` | 26 ERP orders, total Rp8.811.000, DP Rp1.875.000, sisa Rp6.936.000 | DP basis conflicts with other reports. |
| `Laporan_Santi_Living_Komprehensif.pdf` | 26 ERP orders and missing WhatsApp complete rows | Says 21 missing but visible table lists 20. |
| `Laporan_Santi_Living_LENGKAP.pdf` | 46 orders: 26 ERP + 20 WhatsApp, total Rp15.767.000 | Important, but superseded by later Carla state that adds Aries. |
| `img_40df8ddeedcb.jpg` | 856x1 strip | No usable content. |
| `carla-state-message-1745-call-0.content.py` | Final 47 orders: 26 ERP + 21 WhatsApp, total Rp16.482.000 | Most complete Carla artifact found locally. |

## WhatsApp Orders Candidate Missing From Current Sync ERP

These are not in the current 27-row Sync ERP ledger and should be verified/input next. Prices are per-order, not inferred from SKU.

| Ref | Customer | Location | Kirim | Ambil | Nights | Items | Total | DP | Sisa |
|---|---|---|---|---|---:|---|---:|---:|---:|
| WA-01 | Abdul Aziz Salimi | Godean | 15 Mar 26 | 17 Mar 26 | 2 | Q160x1 | Rp128.000 | Rp0 | Rp128.000 |
| WA-02 | Abdul Aziz Salimi | Godean | 19 Mar 26 | 22 Mar 26 | 3 | Q160x1, D120x1 | Rp324.000 | Rp0 | Rp324.000 |
| WA-03 | Alfrida | Wirogunan | 23 Mar 26 | 27 Mar 26 | 4 | Q160x1, Bantalx4 | Rp370.000 | Rp0 | Rp370.000 |
| WA-04 | Antoni | Seyegan | 20 Mar 26 | 24 Mar 26 | 4 | D120x4 | Rp804.000 | Rp0 | Rp804.000 |
| WA-05 | Aries Nandarika | Condongcatur | 3 Apr 26 | 6 Apr 26 | 3 | S100x3, S90x3 | Rp715.000 | Rp300.000 | Rp415.000 |
| WA-06 | Dzaky | Seyegan | 26 Mar 26 | 29 Mar 26 | 3 | Q160x3 | Rp552.000 | Rp0 | Rp552.000 |
| WA-07 | Fendy | Banguntapan | 18 Mar 26 | 25 Mar 26 | 7 | S100x2 | Rp642.000 | Rp0 | Rp642.000 |
| WA-08 | Fendy (Perpanjangan) | Banguntapan | 25 Mar 26 | 28 Mar 26 | 3 | S100x2 | Rp264.000 | Rp0 | Rp264.000 |
| WA-09 | Felis / Ella | Jitar Dukuh | 17 Mar 26 | 23 Mar 26 | 6 | Q160x1, S100x1 | Rp644.000 | Rp300.000 | Rp344.000 |
| WA-10 | Lucky Enjang | BMT BIF Tajem | 17 Mar 26 | 18 Mar 26 | 1 | S90x1 | Rp93.000 | Rp40.000 | Rp53.000 |
| WA-11 | Muji | Jakal KM19 | 24 Mar 26 | 25 Mar 26 | 1 | D120x2(plain), S100x1, D120x2, Selimutx2 | Rp320.000 | Rp0 | Rp320.000 |
| WA-12 | Muji | Jakal KM19 | 25 Mar 26 | 26 Mar 26 | 1 | D120x2(plain), S100x1, D120x2, Selimutx2 | Rp252.000 | Rp0 | Rp252.000 |
| WA-13 | Muji | Jakal KM19 | 26 Mar 26 | 27 Mar 26 | 1 | D120x2(plain), S100x1, D120x2, Selimutx2 | Rp252.000 | Rp0 | Rp252.000 |
| WA-14 | Nisrina | Kotagede | 19 Mar 26 | 23 Mar 26 | 4 | Q160x2 | Rp518.000 | Rp0 | Rp518.000 |
| WA-15 | Nawang | Klaci 3 Seyegan | 12 Apr 26 | 13 Apr 26 | 1 | D120x1 | Rp60.000 | Rp20.000 | Rp40.000 |
| WA-16 | Nawang | Klaci 3 Seyegan | 12 Apr 26 | 14 Apr 26 | 2 | S100x1 | Rp95.000 | Rp30.000 | Rp65.000 |
| WA-17 | Feris | Greenhills Sardonoharjo | 23 Mar 26 | 25 Mar 26 | 2 | S100x1, D120x2, Q160x3 | Rp685.000 | Rp0 | Rp685.000 |
| WA-18 | Zami Fatih | Seyegan | 6 Apr 26 | 10 Apr 26 | 4 | D120x1 | Rp205.000 | Rp0 | Rp205.000 |
| WA-19 | Jhon BT | Sidikan UH V/546 | 28 Mar 26 | 30 Mar 26 | 2 | Q160x1, Sprei S100x1 | Rp183.000 | Rp75.000 | Rp108.000 |
| WA-20 | Harmawan | Swantari Terrace Villa | 11 Apr 26 | 12 Apr 26 | 1 | S90x3 | Rp145.000 | Rp45.000 | Rp100.000 |
| WA-21 | Aryadi | Banguntapan Bantul | 10 Apr 26 | 12 Apr 26 | 2 | D120x4 | Rp420.000 | Rp126.000 | Rp294.000 |

## Still Not ERP-Ready

Carla marked these as `Order Complete` but could not find usable invoice data in visible chat state.

| # | Customer | Reason |
|---:|---|---|
| 1 | Agashi UNY | Chat dari Feb 2026, invoice terenkripsi WhatsApp |
| 2 | d@pi1e - Jakal KM9 | Chat dari Feb 2026, invoice terenkripsi WhatsApp |
| 3 | Harza Arbaha Wates KP | Chat dari Feb 2026, hanya ada KTP dan info bank |
| 4 | Intan Griya Alvita | Chat dari Mar 2026, hanya ada ucapan terima kasih |

## Data Quality Notes

- Current Sync ERP ledger has 27 orders and already includes Bayu `Rp205.000`, which is not present in the Carla Telegram PDF snapshots.
- The current ledger has two rows where `sisa_recorded_idr` is blank/0 even though `total - dp` is nonzero: Meilina UMY tambahan `Rp100.000` and Andhi Kalya Hotel `Rp90.000`. If the app treats blank sisa as unpaid balance differently from computed balance, this needs correction or a clear status rule.
- Carla's PDFs disagree on DP totals: `Rp2.645.000`, `Rp1.875.000`, and final-state ERP snapshot `Rp2.588.000`. For Sync ERP mutation, use row-level invoice/payment evidence, not PDF aggregate DP.
- The 21 WhatsApp candidate rows are strong enough as Carla-reported candidates, but for clean audit they should be linked to raw WhatsApp message IDs/screenshots before posting to ERP.

## Output Files

- Consolidated order CSV: `/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-whatsapp-db-extraction-2026-05-26/carla-all-reports-consolidated-orders-2026-05-27.csv`
- Source index CSV: `/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-whatsapp-db-extraction-2026-05-26/carla-all-reports-source-index-2026-05-27.csv`
- Extracted Telegram texts and Carla state scripts: `/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-whatsapp-db-extraction-2026-05-26/carla-telegram-all-reports-2026-05-27`

## Recommended Next Step

1. Treat the 21 WhatsApp rows as the next ERP input queue.
2. Before mutation, attach raw chat evidence where available; where only Carla state/PDF exists, mark evidence as `carla_report_pending_raw_message`.
3. Input orders one by one via Carla/MCP using backdated dates and exact invoice prices.
4. After input, verify total current Sync ERP becomes `48` orders and `Rp16.687.000` revenue, unless one of the candidate rows is rejected during raw-evidence verification.
