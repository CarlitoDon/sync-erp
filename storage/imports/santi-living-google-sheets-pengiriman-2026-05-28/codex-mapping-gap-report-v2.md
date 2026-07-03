# Codex Mapping V2 - Sheet Pengiriman to Sync ERP

## Ringkasan
- Proposed order dari mapping v1: 34 order, total Rp14,008,000.
- auto_import_candidate: 23.
- needs_review_line_detail: 3.
- needs_review_source_conflict: 8.
- Source conflict/enrichment rows across all ORD: 13.
  - main_items_enrich_or_conflict: 13.
  - total_conflict: 8.

## Interpretasi
- `Daftar Pesanan` dipakai sebagai invoice/order backbone kalau total invoice ada. Jika `Daftar Pesanan` kosong/#N/A, nominal dari mapping/tab operasional `Pengiriman` dipakai.
- Tab operasional `Pengiriman` dipakai untuk memperkaya qty item ketika tanggal/nama match, tetapi kalau nominal berbeda maka order ditahan untuk review.
- Harga historis tidak diinfer dari SKU; line price dihitung dari subtotal sheet per order. Kalau line detail ambigu, status dibuat `needs_review_line_detail`.

## Output
- `codex-erp-import-prep-order-headers.csv`
- `codex-erp-import-prep-order-lines.csv`
- `codex-erp-import-review-needed.csv`
- `codex-sheet-source-conflicts.csv`

## Review Wajib Sebelum ERP Write
- ORD-003 Adani: needs_review_line_detail; no_main_multi_item_needs_manual_split
- ORD-004 Harza: needs_review_line_detail; no_main_multi_item_needs_manual_split
- ORD-006 Vivi: needs_review_line_detail; no_main_multi_item_needs_manual_split
- ORD-011 Yani Andari: needs_review_source_conflict; total_conflict_mapping_1206000_main_1342000
- ORD-013 Intan: needs_review_source_conflict; total_conflict_mapping_147000_main_168000
- ORD-014 Fendy: needs_review_source_conflict; total_conflict_mapping_880000_main_906000
- ORD-015 Antoni: needs_review_source_conflict; total_conflict_mapping_784000_main_804000
- ORD-016 Feris: needs_review_source_conflict; total_conflict_mapping_638000_main_665000
- ORD-018 Alfrida: needs_review_source_conflict; total_conflict_mapping_348000_main_370000
- ORD-019 Dzaky: needs_review_source_conflict; total_conflict_mapping_531000_main_552000
- ORD-020 Eksperian: needs_review_source_conflict; total_conflict_mapping_118000_main_313000
