# Closing vs Imported Rental Order Gap - 2026-05-26

Source closing list: `storage/imports/santi-living-whatsapp-leads-2026-05-26/lead-closing-extraction.csv`
Source imported orders: `storage/imports/santi-living-rental-invoice-investigation-2026-05-26/rental-order-import-candidates.csv`

## Counts
- WhatsApp labeled `closing_or_customer`: 55
- Imported postable invoice orders: 26
- Held invoice rows: 4
- Closing rows matched to imported invoice batch by chat/name heuristic: 30
- Closing rows not covered by imported invoice batch: 25

## Missing Closing Primary Labels
- Order complete: 23
- Down payment: 1
- Paid: 1

## Interpretation
The 26 imported orders are only the invoice-template batch from Web WhatsApp search `INVOICE PEMESANAN`. The separate WhatsApp Business label extraction has many more closing/customer chats. Those need a second deep extraction pass from actual chat messages, because the IndexedDB label export does not contain full message bodies.

## Next Action
For each `needs_deep_chat_invoice_extraction` row, open/export the chat body or query the WhatsApp message store, extract rental date/items/price/ongkir/payment evidence, then create additional draft orders only when an order can be reconstructed without guessing.
