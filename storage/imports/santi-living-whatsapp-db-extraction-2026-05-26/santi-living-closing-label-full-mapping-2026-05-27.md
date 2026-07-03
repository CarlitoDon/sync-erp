# Santi Living Closing Label Full Mapping - 2026-05-27

## Summary

- WhatsApp `closing_or_customer` label rows: 55
- Current Sync ERP `SL-INV-*` rental orders: 27
- Current Sync ERP `SL-INV-*` total: Rp9.016.000
- Closing label rows safely matched to existing ERP orders: 22
- ERP-ready additional rows found in this pass: 2

The gap is real, but it is not safe to import all 55 labels as orders. A label means the chat was marked as closing/customer; it does not always contain a readable invoice in the exported data. Prices changed over time, so rows without invoice totals stay out of ERP.

## Status Counts

| Status | Count |
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

## Primary Label Counts

| Primary label | Count |
|---|---:|
| Down payment | 5 |
| Harus diambil | 3 |
| Order complete | 46 |
| Paid | 1 |

## ERP-Ready Additional Rows

| Customer | Status | Evidence | Action |
|---|---|---|---|
| Cust SL - Fendy Banguntapan | `ready_to_input_complete_invoice` | native:ZWAMESSAGE:66254 | Input draft rental order; payment remains pending unless payment evidence is confirmed. |
| Cust SL - Nisrina Kotagede | `ready_to_input_complete_note_invoice` | browser-note:idx=1; native:ZWAMESSAGE:61781 | Input draft rental order; do not post DP amount yet. |

## Remaining Rows To Review

| Customer | Status | Evidence | Why not input yet |
|---|---|---|---|
| Cust SL - Aryadi Banguntapan | `partial_pickup_schedule_no_total` | native:ZWAMESSAGE:86529 | Aryadi pickup schedule found (Double 120 x4), but no start date/total/ongkir invoice. |
| 120363422057960855@g.us | `group_label_needs_identification` | - | Labeled WhatsApp group has no single customer identity in the label export. |
| Cust SL - Ling Santa Persada Homestay | `label_only_needs_chat_export` | - | WhatsApp Business closing label exists, but local exports do not expose a complete invoice/order body with dates, item lines, ongkir, and total. |
| Cust SL - Misfa Tempel | `partial_schedule_no_total` | native:ZWAMESSAGE:82976; native:ZWAMESSAGE:84713 | Misfa schedule/contact fragments found, but no invoice total or detailed order. |
| Cust SL - Yayoe Jl. Wonosari | `label_only_needs_chat_export` | - | WhatsApp Business closing label exists, but local exports do not expose a complete invoice/order body with dates, item lines, ongkir, and total. |
| Cust SL - dony/ yani minomartani | `label_only_needs_chat_export` | - | WhatsApp Business closing label exists, but local exports do not expose a complete invoice/order body with dates, item lines, ongkir, and total. |
| Cust SL - Antoni Seyegan | `label_only_needs_chat_export` | - | WhatsApp Business closing label exists, but local exports do not expose a complete invoice/order body with dates, item lines, ongkir, and total. |
| Cust SL - Imron Joglo Brongkol Godean | `label_only_needs_chat_export` | - | WhatsApp Business closing label exists, but local exports do not expose a complete invoice/order body with dates, item lines, ongkir, and total. |
| Cust SL - Alfrida Wirogunan | `label_only_needs_chat_export` | - | WhatsApp Business closing label exists, but local exports do not expose a complete invoice/order body with dates, item lines, ongkir, and total. |
| Cust SL - Dzaky Seyegan | `label_only_needs_chat_export` | - | WhatsApp Business closing label exists, but local exports do not expose a complete invoice/order body with dates, item lines, ongkir, and total. |
| Cust SL - Vivi Mergangsan | `label_only_needs_chat_export` | - | WhatsApp Business closing label exists, but local exports do not expose a complete invoice/order body with dates, item lines, ongkir, and total. |
| Cust SL - Via Gamping | `label_only_needs_chat_export` | - | WhatsApp Business closing label exists, but local exports do not expose a complete invoice/order body with dates, item lines, ongkir, and total. |
| Cust SL - Agashi UNY | `needs_review_duplicate_order_candidate` | native:ZWAMESSAGE:32128; native:ZWAMESSAGE:32155 | Agashi has two order-confirmation texts: RNT-000025 total Rp20.000 for 29-30 Jan 2026 and RNT-000026 total Rp40.000 for 29-31 Jan 2026. Need decide which one is the final real order before ERP input. |
| Cust SL - Lucky Tajem | `partial_schedule_and_payment_no_invoice_total` | native:ZWAMESSAGE:61765; native:ZWAMESSAGE:61776 | Lucky schedule found (Single 90 x1, 17-18 Mar 2026) and payment note Lucky Rp93.000 lunas, but no invoice/ongkir breakdown. |
| Cust SL d@π1€£ - Jakal KM9 | `label_only_needs_chat_export` | - | WhatsApp Business closing label exists, but local exports do not expose a complete invoice/order body with dates, item lines, ongkir, and total. |
| Cust SL Harza Arbaha Wates KP | `label_only_needs_chat_export` | - | WhatsApp Business closing label exists, but local exports do not expose a complete invoice/order body with dates, item lines, ongkir, and total. |
| Cust SL - Abdul Aziz Godean | `label_only_needs_chat_export` | - | WhatsApp Business closing label exists, but local exports do not expose a complete invoice/order body with dates, item lines, ongkir, and total. |
| Cust SL - Baby Tamantirto | `label_only_needs_chat_export` | - | WhatsApp Business closing label exists, but local exports do not expose a complete invoice/order body with dates, item lines, ongkir, and total. |
| Cust SL - Muji Jakal Km19 | `partial_payment_no_invoice` | native:ZWAMESSAGE:72525 | Muji payment note says DP Rp320.000, but no date/items/total invoice found. |
| Cust SL - Aries Concat | `label_only_needs_chat_export` | - | WhatsApp Business closing label exists, but local exports do not expose a complete invoice/order body with dates, item lines, ongkir, and total. |
| Cust SL - Intan Griya Alvita | `label_only_needs_chat_export` | - | WhatsApp Business closing label exists, but local exports do not expose a complete invoice/order body with dates, item lines, ongkir, and total. |
| Cust SL - Felis/ Ella Jitar Dukuh | `partial_schedule_and_dp_no_invoice_total` | native:ZWAMESSAGE:61765; native:ZWAMESSAGE:61778 | Felis/Ella schedule found (Queen 160 x1, Single 100 x1, 17-23 Mar 2026) and DP Rp300.000, but no total/ongkir. |
| Cust SL Nawang - Klaci Godean Py | `label_only_needs_chat_export` | - | WhatsApp Business closing label exists, but local exports do not expose a complete invoice/order body with dates, item lines, ongkir, and total. |
| Cust SL - Feris Sardonoharjo | `label_only_needs_chat_export` | - | WhatsApp Business closing label exists, but local exports do not expose a complete invoice/order body with dates, item lines, ongkir, and total. |
| Cust SL - Zami Seyegan | `label_only_needs_chat_export` | - | WhatsApp Business closing label exists, but local exports do not expose a complete invoice/order body with dates, item lines, ongkir, and total. |
| Cust SL - Jhon BT XT Square | `partial_contact_schedule_no_total` | native:ZWAMESSAGE:75056 | Jhon BT/Marjono contact/address fragment found, but no invoice total or dates. |
| Cust SL - Harmawan KulProg | `partial_pickup_schedule_no_total` | native:ZWAMESSAGE:86529 | Harmawan pickup schedule found (Single 90 x3), but no start date/total/ongkir invoice. |
| Cust SL - Asti Bantul | `label_only_needs_chat_export` | - | WhatsApp Business closing label exists, but local exports do not expose a complete invoice/order body with dates, item lines, ongkir, and total. |
| Cust SL - Experian Kemusuk Bantul | `partial_payment_no_invoice` | native:ZWAMESSAGE:72525 | Experian payment note says lunas Rp136.000, but no date/items/ongkir invoice found. |
| Cust SL - Emma Wirogunan | `partial_schedule_no_total` | native:ZWAMESSAGE:82976; native:ZWAMESSAGE:85621; native:ZWAMESSAGE:87651 | Emma schedule/contact fragments found, but no invoice total or detailed order. |
| Cust SL - Bp Adani Palagan 12,5 | `partial_order_evidence_no_total` | native:ZWAMESSAGE:42158 | Adani/Suparmi Palagan schedule found with dates and items (Single 100 x4, Queen 160 x2, sprei x6, bantal x8), but no total/ongkir/payment. |

## Files

- `/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-whatsapp-db-extraction-2026-05-26/santi-living-closing-label-full-mapping-2026-05-27.csv`
- `/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-whatsapp-db-extraction-2026-05-26/santi-living-closing-label-full-mapping-2026-05-27.md`
