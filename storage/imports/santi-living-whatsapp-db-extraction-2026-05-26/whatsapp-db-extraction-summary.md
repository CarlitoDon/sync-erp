# Santi Living WhatsApp DB Extraction Summary

Generated: 2026-05-26 22:56:14 WIB

## Sources

- Chrome Profile 1 IndexedDB snapshot: `/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-whatsapp-db-extraction-2026-05-26/raw/https_web.whatsapp.com_0.indexeddb.leveldb`
- Native WhatsApp ChatStorage snapshot: `/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-whatsapp-db-extraction-2026-05-26/raw/native-whatsapp/ChatStorage.backup.sqlite`

## Results

- Chrome raw order snippets: 1500 rows (80 high-confidence snippets)
- Chrome `Cust SL` contacts recovered from raw snippets: 93
- Native WhatsApp 2026 keyword messages: 3745 rows (7 high-confidence messages)
- Native structured Santi Living orders/payment confirmations: 1537 rows
- Browser IndexedDB export via WhatsApp Web runtime: 1591 contacts, 120 `Cust SL`/Santi Living-like contact rows, 3 notes, 6 quick replies, 10 labels.
- Clean real-WA customer contacts from IndexedDB: 60 rows in `browser-indexeddb-cust-sl-contacts-clean.csv`.
- CUA visible-sidebar extraction: 60 candidate customer rows opened and saved to `visible-chat-texts/`.
- Visible-scope invoice parsing: 23 invoice occurrences, deduped to 18 order candidates totaling Rp6.751.000 in `visible-chat-invoice-candidates-deduped.csv`.
- Corrected payment capture totals: DP Rp1.997.000, sisa pelunasan Rp4.664.000, with only Andhi Setiadhi Rp90.000 still missing DP/sisa structure.
- Sync ERP read-only preflight: the 18 visible ledger rows already match existing `DRAFT`/`PENDING` rental orders; do not create duplicates. Preflight output is in `sync-erp-readonly-preflight-visible-orders-2026-05-26.md` and `.csv`.

## Interpretation

- Chrome Profile 1 is the Santi Living profile and contains `Cust SL` customer names plus invoice/order snippets.
- Chrome IndexedDB uses Chromium's custom IndexedDB LevelDB comparator, so normal LevelDB readers cannot open it directly. This extractor uses read-only binary snippet extraction from a local snapshot.
- Native WhatsApp SQLite is parseable and useful as supporting evidence, especially internal Santi Living schedule/payment/order messages, but it is not treated as the sole customer source.
- WhatsApp Web's IndexedDB `message` store does not expose full plaintext bodies for arbitrary chats; full conversation text was available only for chats opened in the browser DOM.
- CUA AX row selection worked for visible/recent WhatsApp sidebar rows after scrolling each row into the window. URL-based switching and synthetic DOM click did not switch chats reliably.
- Parser fix applied after Carla review: non-standard `DP : Rp...` formatting is now captured, including Alex DP Rp340.000 and sisa Rp794.000.
- These outputs are candidate/evidence extraction only. They are not yet ERP-ready orders until a second pass groups snippets per customer, resolves duplicates/revisions, and confirms closing/payment status.

## Output Files

- `chrome-profile-1-order-snippets.csv`
- `chrome-profile-1-cust-sl-contacts.csv`
- `browser-indexeddb-export.json`
- `browser-indexeddb-cust-sl-contacts-clean.csv`
- `browser-visible-rows-export.json`
- `browser-visible-chat-extraction-manifest.csv`
- `visible-chat-texts/`
- `visible-chat-invoice-candidates.csv`
- `visible-chat-invoice-candidates-deduped.csv`
- `validated-visible-order-ledger-for-sync-erp.csv`
- `sync-erp-readonly-preflight-visible-orders-2026-05-26.csv`
- `sync-erp-readonly-preflight-visible-orders-2026-05-26.md`
- `visible-chat-extraction-report.md`
- `native-whatsapp-order-message-hits.csv`
- `native-santi-living-structured-orders.csv`

## Next Step

Use `visible-chat-invoice-candidates-deduped.csv` as the first recent-order ledger candidate, then continue pagination/scroll extraction for older sidebar rows. Do not input to Sync ERP until each order has invoice/order text, rental dates, item lines, ongkir, total, DP/payment status, and duplicate/revision status.
