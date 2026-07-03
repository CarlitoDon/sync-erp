# Carla Telegram PDF Reconciliation - 2026-05-27

## Result

- Carla WhatsApp PDF source checked: `/Users/wecik/.hermes/profiles/carla/output/santi_living_whatsapp_leads_closings.pdf`
- Carla Telegram order PDF checked: `/Users/wecik/Downloads/Telegram Desktop/santi_living_orders_report.pdf`
- Carla local order PDF checked: `/Users/wecik/.hermes/profiles/carla/output/santi_living_orders_report.pdf`
- WhatsApp PDF total chat rows: 77
- WhatsApp PDF leads/inquiry: 45
- WhatsApp PDF closing/customer rows: 32
- WhatsApp PDF closings with nominal: 26
- WhatsApp PDF zero-total closings: 6
- WhatsApp PDF nominal total: Rp8.811.000
- Carla order PDF Sync ERP snapshot: 26 orders, Rp8.811.000
- Current Sync ERP ledger after Bayu fix: 27 orders, Rp9.016.000
- WhatsApp Business closing/customer label rows from local DB: 55

## Interpretation

Carla's Telegram PDF is useful, but it does not mean there are 50 rental orders ready for ERP. It combines leads and closings:

- 45 rows are leads/inquiries.
- 32 rows are closing/customer rows.
- Only 26 of those 32 have invoice refs and nominal totals in the PDF.
- The 6 remaining closing/customer rows have no invoice ref or total in the PDF, so they are evidence to investigate, not safe ERP input.

The current ERP has 27 orders because `SL-INV-031` Bayu was added after Carla's 26-order PDF snapshot. Separately, the deeper SQLite/browser-note mapping found 2 ERP-ready historical/additional rows not present in Carla's PDF: Fendy and Nisrina.

## Reconciliation Status Counts

| Status | Count |
|---|---:|
| `already_in_sync_erp` | 26 |
| `in_sync_erp_not_in_carla_pdf` | 1 |
| `pdf_zero_total_label_known_needs_invoice_detail` | 5 |
| `pdf_zero_total_not_in_label_mapping_needs_chat_export` | 1 |
| `ready_extra_not_in_carla_pdf_not_in_erp` | 2 |

## Label Mapping Status Counts

| Label mapping status | Count |
|---|---:|
| `erp_mapped_exact` | 22 |
| `group_label_needs_identification` | 1 |
| `label_only_needs_chat_export` | 19 |
| `needs_review_duplicate_order_candidate` | 1 |
| `partial_contact_schedule_no_total` | 1 |
| `partial_order_evidence_no_total` | 1 |
| `partial_payment_no_invoice` | 2 |
| `partial_pickup_schedule_no_total` | 2 |
| `partial_schedule_and_dp_no_invoice_total` | 1 |
| `partial_schedule_and_payment_no_invoice_total` | 1 |
| `partial_schedule_no_total` | 2 |
| `ready_to_input_complete_invoice` | 1 |
| `ready_to_input_complete_note_invoice` | 1 |

## Carla PDF Zero-Total Closings

| Customer | PDF date | PDF invoice ref | Existing label mapping status |
|---|---:|---|---|
| Cust SL - Aan Ngestiharjo Bantul | 19 Apr 2026 | - | not_in_label_mapping |
| Cust SL - Misfa Tempel | 17 Apr 2026 | - | partial_schedule_no_total |
| Cust SL - Emma Wirogunan | 14 Apr 2026 | - | partial_schedule_no_total |
| Cust SL - Baby Tamantirto | 22 Apr 2026 | - | label_only_needs_chat_export |
| Cust SL - Yayoe Jl. Wonosari | 22 Apr 2026 | - | label_only_needs_chat_export |
| Cust SL - Ling Santa Persada Homestay | 1 Mei 2026 | - | label_only_needs_chat_export |

## ERP-Ready Rows Found Outside Carla PDF

| Customer | Status | Evidence | Reason |
|---|---|---|---|
| Cust SL - Fendy Banguntapan | ready_to_input_complete_invoice | native:ZWAMESSAGE:66254 | Complete Fendy invoice found: 18 Mar 2026 to 25 Mar 2026, Paket Single 100 x2, subtotal Rp616.000, ongkir net Rp26.000, total Rp642.000; follow-up says kekurangan Rp442.000. |
| Cust SL - Nisrina Kotagede | ready_to_input_complete_note_invoice | browser-note:idx=1; native:ZWAMESSAGE:61781 | Complete Nisrina note invoice found: 19 Mar 2026 to 23 Mar 2026, Paket Queen 160 x2, subtotal Rp472.000, ongkir Rp46.000, total Rp518.000. Note says sudah dp but DP amount is not present. |

## Files

- `/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-whatsapp-db-extraction-2026-05-26/carla-telegram-pdf-reconciliation-2026-05-27.csv`
- `/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-whatsapp-db-extraction-2026-05-26/carla-telegram-pdf-reconciliation-2026-05-27.md`
