# Santi Living Rental Invoice Extraction - 2026-05-26

Source: Web WhatsApp search query `INVOICE PEMESANAN` in Chrome profile Santi Living.

Extracted invoices: 30
Extracted invoice total: Rp10.545.000
Extracted lines: 55

## Notes

- Harga line dan ongkir diambil dari invoice chat, bukan master rate ERP.
- Paket, kasur saja, add-on, ongkir, diskon, DP, dan sisa disimpan per invoice.
- Correction 2026-05-26: `SL-INV-009` ongkir `Rp70.000 - Rp15.000` disimpan sebagai `deliveryFee=55000`; tidak ada `discountAmount` terpisah karena diskon sudah net ke ongkir.
- Carla preflight 2026-05-26 created missing customer partners before import was paused: `SL-INV-001` Oni, `SL-INV-005` Evi, and `SL-INV-011` Gissa. Candidate CSV now references those partner IDs.
- Rows dari chat perantara seperti `masku purunku` tetap disimpan sebagai evidence tetapi perlu dedupe sebelum posting jika customer chat punya invoice yang sama.
- Item `sprei`, `selimut`, dan `kipas` terdeteksi sebagai untracked add-on karena belum ada master rental stock yang diverifikasi.

## Files

- `web-whatsapp-search-invoice-pemesanan-raw.txt`
- `rental-invoices-extracted.csv`
- `rental-invoice-lines-extracted.csv`
