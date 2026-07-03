# Codex Mapping Google Sheets Pengiriman vs WhatsApp/ERP - 2026-05-28

## Ringkasan
- Total ORD spine mapped: 63.
- Status counts: {'needs_import_from_sheet': 34, 'already_imported_exact': 18, 'already_imported_needs_reference_link': 5, 'schedule_only_or_future': 6}.
- Proposed next import from sheet: 34 orders.
- Unmatched operational rows in `🚚 Pengiriman`: 5 rows.
- Imported WhatsApp invoices not found in ORD spine: 3 rows.

## Interpretasi
Google Sheets Pengiriman bisa dipakai sebagai sumber backbone `ORD-*` untuk banyak order yang belum terinput dari WhatsApp. Untuk order yang sudah ada di Sync ERP via `SL-INV-*`, tugas berikutnya bukan create ulang, tetapi menautkan reference `ORD-*` dan cek mismatch tanggal/nominal.

Aturan match diperketat: invoice WhatsApp harus cocok tanggal mulai dengan `ORD-*`; nama/total hanya penguat. Ini mencegah match palsu antar bulan.

## Gap Prioritas
- ORD-001 Agashi 2026-01-30..2026-02-01 status=needs_import_from_sheet sheet_total=Rp40,000 invoice=- 
- ORD-002 Via 2026-02-05..2026-02-09 status=needs_import_from_sheet sheet_total=Rp140,000 invoice=- 
- ORD-003 Adani 2026-02-14..2026-02-15 status=needs_import_from_sheet sheet_total=Rp300,000 invoice=- 
- ORD-004 Harza 2026-02-14..2026-02-15 status=needs_import_from_sheet sheet_total=Rp375,000 invoice=- 
- ORD-005 Nisrina 2026-03-19..2026-03-23 status=needs_import_from_sheet sheet_total=Rp518,000 invoice=- 
- ORD-006 Vivi 2026-02-18..2026-02-19 status=needs_import_from_sheet sheet_total=Rp110,000 invoice=- 
- ORD-007 Danie 2026-02-20..2026-02-22 status=needs_import_from_sheet sheet_total=Rp133,000 invoice=- 
- ORD-009 Lucky Enjang 2026-03-17..2026-03-18 status=needs_import_from_sheet sheet_total=Rp93,000 invoice=- 
- ORD-010 Felis/Ella 2026-03-17..2026-03-23 status=needs_import_from_sheet sheet_total=Rp618,000 invoice=- 
- ORD-011 Yani Andari 2026-03-18..2026-03-24 status=needs_import_from_sheet sheet_total=Rp1,206,000 invoice=- 
- ORD-012 Abdul Azis 2026-03-15..2026-03-17 status=needs_import_from_sheet sheet_total=Rp128,000 invoice=- 
- ORD-013 Intan 2026-03-17..2026-03-20 status=needs_import_from_sheet sheet_total=Rp147,000 invoice=- 
- ORD-014 Fendy 2026-03-18..2026-03-28 status=needs_import_from_sheet sheet_total=Rp880,000 invoice=- 
- ORD-015 Antoni 2026-03-20..2026-03-24 status=needs_import_from_sheet sheet_total=Rp784,000 invoice=- 
- ORD-016 Feris 2026-03-23..2026-03-25 status=needs_import_from_sheet sheet_total=Rp638,000 invoice=- 
- ORD-017 Abdul Azis 2026-03-19..2026-03-22 status=needs_import_from_sheet sheet_total=Rp324,000 invoice=- 
- ORD-018 Alfrida 2026-03-23..2026-03-27 status=needs_import_from_sheet sheet_total=Rp348,000 invoice=- 
- ORD-019 Dzaky 2026-03-26..2026-03-29 status=needs_import_from_sheet sheet_total=Rp531,000 invoice=- 
- ORD-020 Eksperian 2026-03-24..2026-03-26 status=needs_import_from_sheet sheet_total=Rp118,000 invoice=- 
- ORD-021 Muji 2026-03-24..2026-03-27 status=needs_import_from_sheet sheet_total=Rp824,000 invoice=- 

## Unmatched operational rows
Ada 5 baris operasional tanpa match exact ke `ORD-*`; ini perlu diputuskan apakah extension masuk order existing atau order tambahan.

## Output
- `codex-sheet-vs-whatsapp-erp-order-mapping.csv`
- `codex-proposed-next-import-batch.csv`
- `codex-unmatched-operational-and-imported.csv`
