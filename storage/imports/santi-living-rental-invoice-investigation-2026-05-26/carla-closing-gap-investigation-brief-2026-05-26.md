# Carla Task: Santi Living Closing Gap Investigation

Date: 2026-05-26
Company: Santi Living
Mode: investigation only. Do not mutate Sync ERP.

## Objective

Investigate the 25 WhatsApp Business chats that are labeled as closing/customer but were not covered by the first `INVOICE PEMESANAN` rental-order import. Process targets one by one and collect enough evidence to decide whether each target should become a Sync ERP rental order.

## Source Files

- Target list: `/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-rental-invoice-investigation-2026-05-26/closing-gap-investigation-targets-2026-05-26.csv`
- Gap report: `/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-rental-invoice-investigation-2026-05-26/closing-vs-imported-order-gap-2026-05-26.csv`
- Existing invoice import candidates: `/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-rental-invoice-investigation-2026-05-26/rental-order-import-candidates.csv`
- Existing Sync ERP import result: `/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-rental-invoice-investigation-2026-05-26/sync-erp-rental-order-import-result-2026-05-26.csv`
- Raw WhatsApp label export: `/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-whatsapp-leads-2026-05-26/raw-whatsapp-model-storage-export.json`

## Output Files To Create

Create these files in the same folder as the target list:

- `closing-gap-deep-investigation-2026-05-26.csv`
- `closing-gap-deep-investigation-2026-05-26.md`
- `additional-rental-order-candidates-2026-05-26.csv`
- `additional-rental-order-lines-2026-05-26.csv`

## Evidence Rules

- Do not infer price from package, size, or master rate. Price and ongkir are invoice/chat-specific.
- Acceptable evidence: invoice text, direct chat text, payment/DP message, delivery/return date message, or screenshot/OCR that directly ties to the target chat.
- If a target is already represented by an existing imported order under another chat/name, mark `duplicate_existing` and cite the matching invoice/order ref.
- If the WhatsApp label appears wrong and there is no order/rental evidence, mark `wrong_label_not_closed`.
- If item/date/price/ongkir are incomplete, mark `found_partial` or `needs_manual_review`, not `found_invoice`.

## Per-Target Required Fields

For every target row, record:

- target_no
- chat_id
- phone
- display_name
- investigation_status: `found_invoice`, `found_partial`, `duplicate_existing`, `wrong_label_not_closed`, or `needs_manual_review`
- confidence: high/medium/low
- evidence_source
- evidence_date_or_message_key
- customer_name
- delivery_location
- rental_start_date
- rental_end_date
- duration_nights
- items_summary
- subtotal_idr
- delivery_fee_idr
- discount_idr
- total_idr
- dp_idr
- remaining_idr
- matched_existing_invoice_ref
- notes

## Process

1. Read the target CSV and existing import result.
2. Investigate targets in `target_no` order.
3. For each target, search local WhatsApp exports first. If message bodies are not available, use Web WhatsApp / Chrome profile Santi Living Jogja through CUA or computer use.
4. After each target, append/update the output CSV and write a short progress note in the MD report.
5. Stop and report immediately if access to WhatsApp/Chrome/profile is blocked, if there is a tool error, or if you need user input.
6. Do not call Sync ERP write tools. Do not create/update/delete/confirm/cancel/release/verify payment.

## Final Acceptance Criteria

- All 25 targets have one final investigation status.
- Every `found_invoice` row has enough fields to create a rental order without guessing.
- Additional order candidate files contain only `found_invoice` rows that are not duplicates.
- The report includes counts by status and a clear list of manual questions for unresolved rows.
