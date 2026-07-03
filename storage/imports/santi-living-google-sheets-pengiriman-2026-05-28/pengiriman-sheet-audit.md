# Audit Google Sheets Pengiriman Santi Living - 2026-05-28

Source spreadsheet: Pencatatan Operasional Santi Living (`1ht990BAQ18k_ZQ2w5eoBRWRv3Tjm9DkgoUxL3TBe6Lk`). Export checked via Chrome profile Khusnudhoni and XLSX export on 2026-05-28.

## Findings
- `🔴 DATA Pengiriman - ORD`: 113 shipment-event rows, 56 unique order IDs, range ORD-001..ORD-057, missing in this tab: ORD-008.
- `🚚 Pengiriman`: 56 operational order rows with delivery/pickup dates, items, totals, remaining amount, penalty/tip, and done flags. Total `total_idr` across this tab: Rp22,133,000.
- `🔵 Daftar Pesanan`: 63 order-id rows; 63 nonblank rows and 0 placeholder/empty rows. Rows with explicit invoice total: 19. Total explicit invoice amount: Rp7,431,000.
- `🔴 DASHBOARD Pengiriman`: 74 shipment/trip rows with grouped order IDs, trip dates, distance, delivery cost, fixed/paid flags.

## ERP relevance
This sheet is useful as a stronger order spine than WhatsApp labels alone because it gives stable `ORD-*` IDs, route/shipment events, start/end dates, customer names, locations, item summary, and payment completion flags.

Caveat: `🚚 Pengiriman` has some operational rows that look like extensions or monthly rows without explicit `ORD-*` IDs. For ERP import, use `🔵 Daftar Pesanan` + `🔴 DATA Pengiriman - ORD` as the keyed source, then use `🚚 Pengiriman` to validate item/remaining/penalty/tip details.

## Output files
- `pengiriman-daftar-pesanan-orders.csv`
- `pengiriman-main-operational-orders.csv`
- `pengiriman-shipment-events.csv`
- `pengiriman-dashboard-shipments.csv`
- `source-google-sheet-export-2026-05-28.xlsx`
