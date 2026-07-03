# Santi Living Ongkir Correction - 2026-05-28

## Applied Corrections

These corrections only gross up delivery fees that already had explicit billed-and-discounted evidence in existing ERP notes. Rental order totals were left unchanged.

| Order | Correction | Evidence Basis | Total Impact |
| --- | ---: | --- | ---: |
| RNT-202605-00029 | deliveryFee 10,000; discountAmount 10,000 | `delivery_raw=Ongkir Rp10.000 free review Google Maps` | 0 |
| RNT-202605-00050 | deliveryFee 43,000; discountAmount 43,000 | notes: `Delivery fee Rp43,000 billed then discounted to 0` | 0 |
| RNT-202605-00051 | deliveryFee 15,000; discountAmount 15,000 | `delivery_fee_billed_idr=15000`, `delivery_discount_idr=15000` | 0 |
| RNT-202605-00052 | deliveryFee 15,000; discountAmount 15,000 | `delivery_fee_billed_idr=15000`, `delivery_discount_idr=15000` | 0 |

## Partner Correction

`RNT-202605-00066` was reassigned from typo partner `Cust SL - Eksperian` to existing partner `Cust SL - Experian Kemusuk Bantul`.

- Phone: `6289604406383`
- Address copied from old typo partner: `Perumahan Taman Ayom`
- Delivery fee remains `0` because the current evidence says the full extension delivery fee was removed.

## Verification Snapshot

- Rental orders in current imported scope: 66
- Total order amount: Rp24,042,000
- Total delivery fee after correction: Rp2,100,000
- Total discount after correction: Rp209,000
- Order totals unchanged by this correction batch.

## Remaining Zero-Delivery Orders

These are intentionally not changed by inference. They need full WhatsApp invoice/order evidence if we want to override the current `0` delivery value.

| Order | Current reason |
| --- | --- |
| RNT-202605-00035 | Perpanjangan |
| RNT-202605-00039 | Lanjutan harian, ongkir Rp0 |
| RNT-202605-00040 | Lanjutan harian, ongkir Rp0 |
| RNT-202605-00054 | `delivery_fee_billed_idr=0` |
| RNT-202605-00055 | `delivery_fee_billed_idr=0` |
| RNT-202605-00056 | `delivery_fee_billed_idr=0` |
| RNT-202605-00057 | `delivery_fee_billed_idr=0` |
| RNT-202605-00058 | `delivery_fee_billed_idr=0` |
| RNT-202605-00059 | `delivery_fee_billed_idr=0` |
| RNT-202605-00060 | `delivery_fee_billed_idr=0` |
| RNT-202605-00061 | `delivery_fee_billed_idr=0` |
| RNT-202605-00066 | Full extension delivery fee removed |

