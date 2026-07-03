# Santi Living x Santi Mebel Payment Investigation

Date: 2026-05-25

Scope: asset purchases by Santi Living from Santi Mebel, based on WhatsApp database/export evidence and the existing Sync ERP/import baseline. Customer payments to Santi Living and unrelated Santi Mebel retail transactions are excluded.

## Executive Summary

The direct WhatsApp chat with `Fajar Sudrajad HRD` was exported from `ChatStorage.sqlite`, not from the WhatsApp UI:

- Export folder: `storage/imports/whatsapp-fajar-sudrajad-hrd-export-2026-05-25/`
- Chat CSV: `fajar-sudrajad-hrd-chat.csv`
- Readable export: `fajar-sudrajad-hrd-chat.md`
- Media copied: 4 files under `media/`

This export changes the earlier conclusion. The first Santi Living debt was not best modeled from the Sync ERP/import purchase totals. Fajar's Jurnal/Talenta evidence maps it as a payroll loan of Rp9.553.331:

- 2026-02-23 msg 49244: Fajar sends Jurnal outstanding screenshot for `MAS DONI (WA GHANA)`, `Piutang belum dibayar (4) Rp9.553.331`.
- 2026-02-23 msg 49245: Fajar says the total is split into 6 deductions.
- 2026-02-23 msg 49252: Fajar says it is about Rp1,59 juta per month.
- 2026-04-20 msg 93190: Talenta loan detail shows Rp1.590.000 credited on 2026-02-27 and Rp1.590.000 credited on 2026-03-27, with remaining Rp6.373.331 at that snapshot.
- 2026-05-15 msg 122654: Fajar says the remaining balance is Rp4.783.331.
- 2026-05-15 msg 122773: transfer receipt proves Rp4.783.331 paid to Ika Hendrasanti, note `pelunasan utang dhoni`.
- 2026-05-24/25 msgs 130584, 131138, 131140, 131186, 131206: follow-up confirms the Santi Mebel debt was already considered settled; only the unrelated Rp50.000 late-transfer deduction remains.

Current best classification:

| Bucket | Purchase refs | Purchase baseline total | Payment/accounting basis |
| --- | --- | ---: | ---: |
| payroll_installment_loan | P001, P002, P003, BG003 | Rp10.048.818 | Rp9.553.331 |
| cash/lunas, evidence found | P004, BG005, P005, P006, BG007, P007 | Rp6.932.296 | Rp6.932.296 |
| unknown, purchase found but payment proof not found | none | Rp0 | Rp0 |

The payroll loan is financially mapped and paid off. P006 was later corrected from `unknown` to `cash/lunas` after adjacent media inspection found Sales Olshop msg `92508`, an image-only Jago transfer receipt for Rp1.616.000.

Sync ERP currently still has bill `paidAmount = 0` for these bills, so ERP payment status is not a source of truth yet.

Important pricing rule: harga beli Santi Living ke Santi Mebel berubah-ubah. Do not infer price from SKU, item name, or mattress size alone. Use the price evidence for the exact purchase ref/date, because the same item can have a different original SO price, special HPP/Jurnal basis, or later cash purchase price.

## Purchase Ledger

| purchase_ref | date | items | purchase_total_idr | payment_basis_idr | payment_bucket | confidence | evidence_message_ids | reason |
| --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| P001 | 2026-01-29 | RGE 90 biru 1 x 500860 | 500.860 | 469.409 | payroll_installment_loan | high | 32135;32136;32138;32141;32157;32158;32159;32161;32162;32250;32434;32445;32447;46094;48334;49244;49245;49252 | Included in Fajar/Jurnal 4-invoice loan total. Payment basis uses special HPP grand 90 Rp469.409 from msg 48334 and the hidden fourth invoice implied by the Rp9.553.331 outstanding total. |
| P002 | 2026-02-13 | RGE 100 biru 4; RGE 160 biru 2; Bantal Springback 7 | 4.518.994 | 4.076.358 | payroll_installment_loan | high | 41368;41372;41373;41385;41386;41397;41423;41424;41435;41961;41980;42120;42123;42317;42340;42556;42557;46094;48334;49244;49245;49252 | Fajar screenshot msg 49244 shows Sales Invoice #60333 Rp4.076.358. This matches special HPP: 4x grand 100 Rp536.400 + 2x grand 160 Rp790.379 + 7x springback Rp50.000. |
| P003 | 2026-02-14 | RGE 160 biru 4; RGE 120 biru 2; Bantal Springback 2; Bantal Comfy 7; Bantal Royal King 1 | 4.848.964 | 4.827.564 | payroll_installment_loan | high | 43573;43615;43616;43633;43709;44599;44716;44719;44717;44795;44807;44808;44809;46094;48334;49244;49245;49252 | Fajar screenshot msg 49244 shows Sales Invoice #60336 Rp4.827.564. This matches special HPP for the confirmed items. |
| BG003 | 2026-02-20 | Guling Comfy 4 x 45000 | 180.000 | 180.000 | payroll_installment_loan | high | 45500;45509;45511;48272;48320;48334;49244;49245;49252;49290;49292;49297;51499;46094 | Fajar screenshot msg 49244 shows Sales Invoice #60074 Rp180.000; the direct Fajar chat confirms this debt was being split into payroll deductions. |
| P004 | 2026-03-19 | RGE 120 biru 4; Bantal Comfy 9 | 2.874.896 | 2.874.896 | cash/lunas | high | 68526;68527;68539;68543;68569;68578;68580;68595;68601;68604;68605;68610;68611;68624;68627;68628;68640;68668;68681;68747;68749 | Ghana asked cash, invoice #62205 was referenced, and payment was marked lunas; this overrides current ERP open-credit note. |
| BG005 | 2026-03-23 | Bantal Royal King 4 x 28600 | 114.400 | 114.400 | cash/lunas | high | 71198;71201;71227;71229;71290;71442;71470;72405 | Transfer/Jurnal line says Nama Doni, Barang bantal royal king, Jumlah Rp114.400. |
| P005 | 2026-04-03 | RGE 90 biru 2 x 567000 | 1.134.000 | 1.134.000 | cash/lunas | high | 80315;80318;80420;80429;80430;80469;80470;80480 | Jurnal entry says nama Doni, barang grand 90, jumlah Rp1.134.000; invoice #63002 thumbnail confirms item and total. |
| P006 | 2026-04-18 | RGE 90 biru 1; RGE 100 biru 1; Bantal Springback 3 | 1.616.000 | 1.616.000 | cash/lunas | high | 92161;92162;92177;92183;92197;92210;92211;92222;92223;92225;92226;92262;92263;92264;92266;92267;92270;92280;92286;92287;92289;92474;92508;96095;96240;96242 | Purchase and delivery are confirmed. Payment proof found in Sales Olshop msg 92508: Jago transfer Rp1.616.000 on 2026-04-19 07:57 WIB, transfer ID 260419SYATIDJ100005822, note kasur 2 bantal 3. |
| BG007 | 2026-05-06 | Bantal Springback 8 x 50000 | 400.000 | 400.000 | cash/lunas | high | 110053;110060;110067;110082;112171;113025;113034;113039;121914 | Jurnal/transfer says Bantal Springback 8 / Rp400.000; user clarified bantal saja. |
| P007 | 2026-05-14 | RGE 100 biru 1 x 793000 | 793.000 | 793.000 | cash/lunas | high | 121887;121896;121897;121905;121908;121919;121925;121926;121929;121943;121951;121958;121971;121972;121886;121890;121899;121917;121923;121924;121930;121931;121932;122036 | Invoice #65396 and Kiriman bukti transfer say nama Doni, barang grand exclusive 100, jumlah Rp793.000, bank BCA. |

## Payroll Loan Reconciliation

### Loan Principal

| Included ref | Payment/accounting basis | Evidence |
| --- | ---: | --- |
| P001 | Rp469.409 | Special HPP grand 90 from msg 48334; hidden fourth invoice implied by Fajar/Jurnal total. |
| P002 | Rp4.076.358 | Fajar screenshot msg 49244, Sales Invoice #60333. |
| P003 | Rp4.827.564 | Fajar screenshot msg 49244, Sales Invoice #60336. |
| BG003 | Rp180.000 | Fajar screenshot msg 49244, Sales Invoice #60074. |
| Total payroll loan | Rp9.553.331 | Fajar/Jurnal outstanding total in msg 49244. |

The Sync ERP/import baseline for the same four purchase refs totals Rp10.048.818. The Rp495.487 difference is not a payment gap; it is a pricing-basis mismatch between earlier SO/import totals and the special HPP/Jurnal/Talenta basis used for the actual employee loan.

### Payment Events

| event_no | date | amount | channel | evidence | status |
| ---: | --- | ---: | --- | --- | --- |
| 1 | 2026-02-27 | Rp1.590.000 | payroll/Talenta | Fajar screenshot msg 93190; Fajar chat msg 49245/49252 | confirmed |
| 2 | 2026-03-27 | Rp1.590.000 | payroll/Talenta | Fajar screenshot msg 93190 | confirmed |
| 3 | between 2026-04-20 and 2026-05-15 | Rp1.590.000 | payroll/Talenta or HR adjustment | Derived from Fajar balance: Rp9.553.331 - Rp1.590.000 - Rp1.590.000 - Rp4.783.331 = Rp1.590.000 | balance-derived |
| 4 | 2026-05-15 13:14 WIB | Rp4.783.331 | manual transfer Jago to BCA Ika Hendrasanti | Transfer receipt msg 122773, note `pelunasan utang dhoni`; Fajar sent balance msg 122654 | confirmed |
| Total |  | Rp9.553.331 |  |  | reconciled |

Event 3 is the only payment event without a standalone payroll slip found in the WhatsApp DB/export. It is still financially reconciled because Fajar's own remaining balance and the final transfer close the exact Rp9.553.331 loan total.

## Cash/Lunas Purchases

Confirmed from available evidence:

| purchase_ref | total | proof summary |
| --- | ---: | --- |
| P004 | Rp2.874.896 | Ghana asked cash; invoice #62205; payment marked lunas in evidence. |
| BG005 | Rp114.400 | Transfer/Jurnal line for Bantal Royal King, amount Rp114.400. |
| P005 | Rp1.134.000 | Jurnal entry for grand 90, amount Rp1.134.000; invoice #63002. |
| P006 | Rp1.616.000 | Jago transfer receipt in Sales Olshop msg 92508; transfer ID 260419SYATIDJ100005822; note `kasur 2 bantal 3`. |
| BG007 | Rp400.000 | Jurnal/transfer line for Bantal Springback 8, amount Rp400.000. |
| P007 | Rp793.000 | Invoice #65396 and transfer/Jurnal evidence, amount Rp793.000. |

Cash/lunas subtotal with direct evidence: Rp6.932.296.

## Remaining Gap

No purchase remains unmapped after P006 correction.

Previous status `unknown` was caused by relying on SQLite text/metadata search. The P006 proof is an image-only receipt; the searchable message text is only `Sudah tak bayar ya`, so OCR/visual inspection or adjacent-media review was required.

## Sync ERP Correction Recommendation

Recommended data corrections after review:

1. Record the initial loan group P001/P002/P003/BG003 on the payment basis Rp9.553.331, not the earlier Rp10.048.818 import/SO basis, or explicitly book the Rp495.487 pricing adjustment.
2. Post payroll/loan payments:
   - 2026-02-27 Rp1.590.000
   - 2026-03-27 Rp1.590.000
   - one Rp1.590.000 HR/payroll adjustment between 2026-04-20 and 2026-05-15, pending exact slip
   - 2026-05-15 Rp4.783.331 transfer receipt
3. Mark P004, BG005, P005, P006, BG007, and P007 cash/lunas with their transfer/Jurnal/media references.
4. Attach P006 evidence file `storage/imports/santi-living-payment-final-2026-05-25/evidence/jago_transfer_p006_msg_92508.jpg` and WhatsApp msg `92508` to the ERP posting.

## Validation

| Check | Result |
| --- | --- |
| Purchase ledger total | Rp16.981.114 |
| Payroll loan purchase refs | P001, P002, P003, BG003 |
| Payroll loan payment basis total | Rp9.553.331 |
| Payroll loan payments reconciled to basis total | pass |
| Cash/lunas total with direct evidence | Rp6.932.296 |
| Unknown purchase total | Rp0 |
| All purchase refs have exactly one bucket | pass |
| ERP bill paid amounts used as payment truth | no, all currently `paidAmount = 0` |
