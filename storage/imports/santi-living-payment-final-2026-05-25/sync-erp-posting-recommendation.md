# Sync ERP Posting Recommendation

Date: 2026-05-25

## Recommended Corrections

1. For P001, P002, P003, and BG003, create or correct the payable/loan basis to Rp9,553,331 total. Do not use the Rp10,048,818 purchase-import baseline as the payable basis unless a separate Rp495,487 price-adjustment entry is booked.
2. Post settlement against that debt group:
   - 2026-02-27 Rp1,590,000, `confirmed`, evidence Fajar/Talenta msg 93190. In Santi Living books this is Doni capital contribution via salary offset at Santi Mebel.
   - 2026-03-27 Rp1,590,000, `confirmed`, evidence Fajar/Talenta msg 93190. In Santi Living books this is Doni capital contribution via salary offset at Santi Mebel.
   - 2026-04-20..2026-05-15 Rp1,590,000, `balance_derived`, evidence from Fajar balance reconciliation. In Santi Living books this is Doni capital contribution via salary offset at Santi Mebel.
   - 2026-05-15 Rp4,783,331, `confirmed`, evidence transfer receipt msg 122773. This payoff is from Santi Living operating income via Bank Jago.
3. Mark these as `cash/lunas` with their references: P004 Rp2,874,896; BG005 Rp114,400; P005 Rp1,134,000; P006 Rp1,616,000; BG007 Rp400,000; P007 Rp793,000.
4. For P006, post payment on 2026-04-19 Rp1,616,000 via manual transfer Jago to BCA Ika Hendrasanti. Evidence: Sales Olshop msg `92508`, copied file `jago_transfer_p006_msg_92508.jpg`, transfer ID `260419SYATIDJ100005822`, receipt note `kasur 2 bantal 3`.

## Accounting Note

Harga beli Santi Living ke Santi Mebel berubah-ubah. ERP correction should not infer purchase price from item master, SKU, size, or another transaction. Use the evidence-specific price per purchase ref, because the same size/item can have different SO price, special HPP/Jurnal basis, or later cash purchase price.

The Rp495,487 mismatch should be represented explicitly as either:

- `price_adjustment` from import/SO basis down to Fajar/Talenta loan basis, preferred if the asset cost in ERP already uses the import/SO amount; or
- direct correction of the initial bill amounts to the Fajar/Jurnal HPP basis, preferred if Sync ERP should mirror actual payable amount rather than original WhatsApp import basis.

Recommended default: use `price_adjustment`, because it preserves auditability between WhatsApp purchase extraction and Santi Mebel/Fajar debt settlement evidence.

For Santi Living GL, the first three Rp1,590,000 settlements should credit `3210 Modal Doni - Setoran via Gaji Santi Mebel`. They are not Santi Living payroll expense. The final Rp4,783,331 payoff should credit Bank Jago because it came from Santi Living operating income.

## Acceptance Checks Before ERP Mutation

- Final purchase ledger total remains Rp16,981,114.
- Initial debt settlement equals Rp9,553,331 exactly: Rp4,770,000 owner contribution plus Rp4,783,331 Bank Jago payoff.
- P006 is posted paid/cash-lunas with Sales Olshop msg `92508` evidence attached.
- Every posted payment has an evidence message or copied evidence file from this bundle.
