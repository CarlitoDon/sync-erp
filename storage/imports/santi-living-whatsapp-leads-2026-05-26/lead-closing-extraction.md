# Santi Living WhatsApp Lead/Closing Extraction Report

Date: 2026-05-26
Source: WhatsApp Business in Chrome profile `Santi Living Jogja`, exported from Web WhatsApp IndexedDB `model-storage` and visually confirmed with CUA page text.
Raw file: `raw-whatsapp-model-storage-export.json`
Output CSV: `lead-closing-extraction.csv`

Important limitation: WhatsApp message bodies are not available as plain text in this `model-storage` export. The extraction uses WhatsApp Business labels, chat metadata, contact metadata, and available chat preview metadata.

## Raw Data Counts

| Entity | Count |
|---|---:|
| Chat rows | 268 |
| Contact rows | 1589 |
| Label rows | 10 |
| Label-association rows | 89 |

## Labels Defined

| ID | Name |
|---:|---|
| 1 | New customer |
| 2 | New order |
| 3 | Pending payment |
| 4 | Paid |
| 5 | Order complete |
| 6 | Important |
| 7 | Follow up |
| 8 | Lead |
| 9 | Down payment |
| 10 | Harus diambil |

## Extraction Counts

| Metric | Count |
|---|---:|
| Unique labeled chats | 82 |
| Multi-label chats | 7 |
| Rows with phone resolved | 81 |
| Rows with display_name resolved | 81 |
| Rows with address_book_name resolved | 56 |
| Group rows without single phone | 1 |
| Total extraction rows | 82 |

## Status Bucket Counts

| Bucket | Count | Rule |
|---|---:|---|
| `lead_open` | 27 | Labels: Lead, Follow up, New customer |
| `closing_or_customer` | 55 | Labels: New order, Down payment, Pending payment, Paid, Order complete, Harus diambil |
| `other_labeled` | 0 | Labeled but not enough to classify as lead/closing |
| **Total** | **82** | |

## Label Association Counts

| Label | Raw Associations |
|---|---:|
| Order complete | 47 |
| Lead | 27 |
| Down payment | 7 |
| Important | 4 |
| Harus diambil | 3 |
| Paid | 1 |

## Primary Label Counts

Primary label is a helper field chosen by business priority. Full source labels remain in the `labels` column.

| Primary Label | Rows |
|---|---:|
| Order complete | 46 |
| Lead | 27 |
| Down payment | 5 |
| Harus diambil | 3 |
| Paid | 1 |

## Multi-Label Chats

| Chat ID | Phone | Display Name | Labels | Bucket |
|---|---|---|---|---|
| 104561045938228@lid | 62818466089 | Cust SL - Abdillah Ngestiharjo | Important|Down payment | closing_or_customer |
| 121393123475638@lid | 6281215588861 | Cust SL - Andi JaMal | Important|Down payment | closing_or_customer |
| 170450223128805@lid | 6285624395440 | Cust SL - Supriyanto Ambarketawang | Down payment|Harus diambil | closing_or_customer |
| 222475162022138@lid | 6281328128489 | Cust SL - M. Lutfi Sinduharjo | Important|Down payment | closing_or_customer |
| 235286965551238@lid | 6282136362874 | Cust SL - Baby Tamantirto | Paid|Order complete | closing_or_customer |
| 55233296212136@lid | 6281350241158 | Cust SL - Retno Sedayu | Down payment|Harus diambil | closing_or_customer |
| 60417489526897@lid | 6281903788728 | Cust SL - Tri Minomartani | Important|Down payment | closing_or_customer |

## Notes

- 81 of 82 rows have a resolved phone number; the one exception is a WhatsApp group chat: `120363422057960855@g.us`.
- `New order`, `Pending payment`, `Follow up`, and `New customer` labels exist as label definitions but have 0 associations in this export.
- `Important` appears only together with `Down payment`, so it does not create `other_labeled` rows.
- `last_chat_at` is normalized to Asia/Jakarta ISO timestamp.
- No Sync ERP mutation was performed; this is an extraction/reporting bundle only.

## CSV Columns

| Column | Description |
|---|---|
| `chat_id` | WhatsApp chat identifier |
| `chat_type` | `contact` or `group` |
| `phone` | Resolved phone number digits when available |
| `display_name` | Best available contact name using address book name, short name, then pushname |
| `address_book_name` | Saved contact name or short name |
| `pushname` | WhatsApp pushname when available |
| `labels` | Pipe-separated WhatsApp Business labels |
| `primary_label` | Business-priority helper label |
| `status_bucket` | `lead_open`, `closing_or_customer`, or `other_labeled` |
| `last_chat_at` | Asia/Jakarta ISO timestamp from chat metadata |
| `unread_count` | Unread count from chat metadata |
| `archived` | Archive flag from chat metadata |
| `chat_opened` | Whether Web WhatsApp has opened the chat according to metadata |
| `preview_type` | Available chat preview type, if any |
| `preview_text` | Available preview text/reaction, if any |
| `preview_msg_key` | Preview message key when available |
| `evidence_key` | Trace key back to label association |
| `source` | Extraction source identifier |
