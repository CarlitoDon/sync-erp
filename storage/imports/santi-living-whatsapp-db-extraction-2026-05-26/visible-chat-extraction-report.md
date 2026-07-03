# Visible WhatsApp Chat Extraction Report

Generated: 2026-05-26 23:27 WIB

## Scope

Source is Chrome Profile 1 / WhatsApp Web for `Santi Living`.

This pass covers the currently reachable/recent sidebar rows captured in `browser-visible-rows-export.json`, then opened through CUA AX row selection. This is not yet a claim that every historical customer chat has been exhausted.

## Outputs

- `browser-indexeddb-export.json`: browser IndexedDB export for contacts, notes, quick replies, labels, chat sample, and the open chat at export time.
- `browser-indexeddb-cust-sl-contacts-clean.csv`: 60 clean `Cust SL`/Santi Living contact rows with real WhatsApp JIDs.
- `browser-visible-rows-export.json`: 76 sidebar rows visible/reachable at extraction start.
- `browser-visible-chat-extraction-manifest.csv`: 60 opened candidate customer rows.
- `visible-chat-texts/`: one text file per opened chat.
- `visible-chat-invoice-candidates.csv`: 23 invoice occurrences parsed from extracted chat text.
- `visible-chat-invoice-candidates-deduped.csv`: 18 deduped invoice/order candidates.

## Validation

- CUA extraction status: 60/60 rows opened with matching chat header.
- Invoice-bearing chats: 18 unique chats.
- Deduped invoice rows: 18.
- Deduped visible-scope invoice total: Rp6.751.000.
- Captured DP total: Rp1.997.000 across 17 rows.
- Captured sisa pelunasan total: Rp4.664.000 across 17 rows.
- Remaining missing DP/sisa row: Andhi Setiadhi Rp90.000.
- Non-invoice extracted chats: 42, treated as lead/non-closing/needs manual classification until invoice or payment evidence is found.

## Deduped Visible Invoice List

| Customer | Send Date | Return Date | Total |
|---|---:|---:|---:|
| Bu Pujo | 21 Mei 2026 | 22 Mei 2026 | Rp94.000 |
| Meilina | 23 Mei 2026 | 27 Mei 2026 | Rp430.000 |
| Oni | 30 Mei 2026 | 31 Mei 2026 | Rp315.000 |
| Helena | 20 Mei 2026 | 27 Mei 2026 | Rp369.000 |
| An Supriyanto | 26 Mei 2026 | 1 Juni 2026 | Rp355.000 |
| Retno | 26 Mei 2026 | 30 Mei 2026 | Rp745.000 |
| Wahida | 20 Mei 2026 | 23 Mei 2026 | Rp300.000 |
| Tri Widh | Sabtu, 30 Mei 2026 | Senin, 1 Juni 2026 | Rp430.000 |
| Evi | Sabtu, 1 Agustus 2026 | Senin, 3 Agustus 2026 | Rp482.000 |
| M. Lutfi | 29 Mei 2026 | 1 Juni 2026 | Rp196.000 |
| Hernawan | 17 Mei 2026 | 18 Mei 2026 | Rp186.000 |
| Salsa | 14 Mei 2026 | 17 Mei 2026 | Rp375.000 |
| Wening | 14 Mei 2026 | 17 Mei 2026 | Rp200.000 |
| Gissa | 15 Mei 2026 | 17 Mei 2026 | Rp150.000 |
| Andhi Setiadhi | 14 Mei 2026 | 15 Mei 2026 | Rp90.000 |
| Uwie | 15 Mei 2026 | 16 Mei 2026 | Rp90.000 |
| Alex | 7 Mei 2026 | 9 Mei 2026 | Rp1.134.000 |
| Abdillah Anwar | 5 Juni 2026 | 6 Juni 2026 | Rp810.000 |

## Caveats

- Opening chats through WhatsApp Web may mark unread chats as read. This pass did open visible candidate rows to obtain full chat text.
- Rows not currently reachable in the sidebar still need pagination/scroll extraction or another source.
- `visible-chat-invoice-candidates-deduped.csv` is a candidate ledger. It still needs ERP preflight for existing rental orders, duplicate references, item mapping, payment status, and delivery/return status before posting.
