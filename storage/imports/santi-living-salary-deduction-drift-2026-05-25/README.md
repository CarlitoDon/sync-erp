# Santi Living Salary Deduction Drift Audit - 2026-05-25

## Finding

WhatsApp evidence confirms a recurring payroll deduction drift:

- Expected internal Santi Living installment: Rp1,562,222 per month.
- Talenta/Fajar payroll loan deduction used: Rp1,590,000 per month.
- Monthly over-deduction: Rp27,778.
- Evidence of monthly correction transfers found 3 times: 2026-03-03, 2026-03-31, and 2026-05-02.
- Confirmed correction total: Rp83,334.
- Follow-up evidence shows Doni transferred Rp27,778 to Muthia/Rumah Cemoro on 2026-05-19 with note "kelebihan kasur gaji". User clarified this is household/Rumah Cemoro daily ops/laundry, not Santi Living.
- User clarified the recurring flow: after Rani transferred the monthly Rp27,778 correction to Doni, Doni forwarded that money to Mila/Mungil/Muthia for Rumah Cemoro household needs.
- The separate Rp1,060,000 evidence on 2026-05-16 is not the monthly drift. It is a Mandiri transfer to Floribertus Fajar Su captioned "Kurangan Gaji dimasukkan kasbon 1.060.000" and should not be posted to Santi Living without separate confirmation.

This does not change the Santi Mebel loan/AP settlement total currently entered in Sync ERP, because the Talenta/Fajar loan ledger still reconciles:

- Payroll deductions in Talenta: Rp1,590,000 x 3 = Rp4,770,000.
- Final payoff: Rp4,783,331.
- Initial Talenta/Jurnal loan basis: Rp9,553,331.

Superseding clarification from user: the drift is not the Santi Living payment amount. The business agreement should be recorded simply as Santi Living paying Santi Mebel installments at Rp1,562,222 per month. The Rp27,778/month difference was a Talenta input correction handled by Rani's refund to Doni, not an extra Santi Living payment. Therefore Sync ERP should not keep Rp1,590,000/month as the operating installment basis.

## Evidence Table

| date | chat | msg_id | evidence | amount | note |
| --- | --- | ---: | --- | ---: | --- |
| 2026-02-08 | Jingga AR Santi Mebel | 39159 | "aku kemarin ambil kasur cicil per kasur 100rb per bulan ya" | - | Early instruction to AR/Jingga for mattress installment handling. |
| 2026-02-23 | Fajar Sudrajad HRD | 49244, 49245, 49252 | Jurnal screenshot total Rp9,553,331; "dipotong 6 kali"; "sekitar 1,59 perbulan potongane" | 1,590,000/month | Official payroll-loan basis. |
| 2026-02-26 | INTERNAL Santi Living | 51478 | "Cicil Per Bulan ke Santi Mebel Februari - Juli 2026 Rp1,562,222" | 1,562,222/month | Internal expected amount. |
| 2026-02-28 | Ibuk | 53686 | Salary calculation uses "tagihan kasur santi mebel 1,562,222" | 1,562,222/month | Confirms expected net deduction used in personal cashflow. |
| 2026-03-03 | Jingga AR Santi Mebel | 56161 | "kekurangan gaji tf nanti ya" | - | AR/Jingga context for salary-shortage transfer. |
| 2026-03-03 | Rani Santi Mebel | 56671 | Transfer instruction to BCA Khusnudhoni, KEU459 | 27,778 | First correction transfer. |
| 2026-03-03 | grup keuangan berdelapan | 56801 | "03 maret kekurangan gaji mas dhoni 27.778.pdf" | 27,778 | PDF receipt confirms successful transfer to BCA 0374146374. |
| 2026-03-31 | Rani Santi Mebel | 77856 | Transfer instruction to BCA Khusnudhoni, KEU604 | 27,778 | Second correction transfer. |
| 2026-04-02 | grup keuangan berdelapan | 79439 | "31 maret kekurangan gaji mas dhoni 27.778.pdf" | 27,778 | Supporting finance bundle. |
| 2026-05-02 | Rani Santi Mebel | 106402 | Transfer instruction to BCA Khusnudhoni, KEU803 | 27,778 | Third correction transfer. |
| 2026-05-02 | grup keuangan berdelapan | 106560 | "02 mei kekurangan gaji mas dhoni 27.778.pdf" | 27,778 | Supporting finance bundle. |
| 2026-04-20 | Fajar Sudrajad HRD | 93190 | Talenta loan screenshot | 1,590,000 x 2 posted; remaining Rp6,373,331 | Confirms official loan ledger still tracks Rp1,590,000 installments. |
| 2026-05-15 | Fajar Sudrajad HRD | 122654, 122773 | Remaining Rp4,783,331 and final Jago transfer receipt | 4,783,331 | Final payoff from Santi Living operations. |
| 2026-05-16 | grup keuangan berdelapan | 123709 | Decrypted Livin Mandiri receipt to Floribertus Fajar Su; caption "16 mei Kurangan Gaji dimasukkan kasbon 1.060.000" | 1,060,000 | Separate salary/kasbon transfer to Fajar. Not part of the Rp27,778 Santi Living drift. |
| 2026-05-19 | Rumah Cemoro Giant + Mungil | 125340 | Decrypted Jago receipt Doni to Muthia; note "kelebihan kasur gaji" | 27,778 | Household/Rumah Cemoro transfer. User clarified this is not Santi Living and must not be posted to Sync ERP. |
| 2026-05-25 | Yudi Keuangan SM | 131387 | Decrypted screenshot listing debt invoices #60074, #60132, #60133, #60136 | 9,553,331 | Supports Yudi's "yang kemaren jadi utang dan udah di lunasin" context for the non-cash loan bucket. |

## Calculation

```text
Expected monthly deduction   = Rp1,562,222
Actual payroll deduction     = Rp1,590,000
Monthly drift                = Rp27,778
Confirmed drift months       = 3
Confirmed drift correction   = Rp83,334

Correct installment amount per month                   = Rp1,562,222
Current Sync ERP installment amount per month           = Rp1,590,000
Monthly drift                                          = Rp27,778
Confirmed corrected months via Rani transfer           = 3
Confirmed first-3-month drift correction               = Rp83,334

P001/P002/P003 purchase basis                          = Rp9,373,331
P001/P002/P003 correct first 3 installments            = Rp4,686,666
P001/P002/P003 exact remaining final 3 installments    = Rp4,686,665

Current Sync ERP owner contribution via AP settlement  = Rp4,770,000
Correct owner contribution basis                       = Rp4,686,666
Owner contribution reduction required                  = Rp83,334

Current final payoff transfer recorded                 = Rp4,783,331
If corrected by 3x drift only                          = Rp4,699,997
If corrected to exact P001/P002/P003 remaining         = Rp4,686,665
```

## Sync ERP Recommendation

Do not change purchase items or purchase prices. Change the payment classification/amount basis.

The six-month installment group should be treated as P001/P002/P003, total Rp9,373,331, not P001/P002/P003/BG003 Rp9,553,331, because Rp1,562,222/month reconciles to P001/P002/P003 only.

Correct the first three installment postings from Rp1,590,000/month to Rp1,562,222/month. The three Rani transfers of Rp27,778 are evidence that Talenta's higher number was corrected; they are not additional Santi Living cash inflow.

For the final direct payoff, there are two possible accounting treatments that must not be mixed:

1. Clean P001/P002/P003 installment basis: final payoff against those bills should be Rp4,686,665. Since the actual transfer evidence is Rp4,783,331, Santi Living has a refund/receivable claim of Rp96,666.
2. User-requested drift-only correction: final payoff is reduced by Rp83,334 to Rp4,699,997. This matches the planned refund request of 3 x Rp27,778, but leaves Rp13,332 over the exact P001/P002/P003 six-month basis and needs a separate classification.

Do not mutate Sync ERP until the final policy between option 1 and option 2 is selected. Option 1 is the cleaner ERP ledger because it fully reconciles the six-month installment group to P001/P002/P003.

## Decrypted Media

The following WhatsApp media were downloaded from `mmg.whatsapp.net` and decrypted using the local WhatsApp media keys stored in `ChatStorage.sqlite`:

- `evidence-media/msg-123709-kurangan-gaji-kasbon-1060000.jpg`
- `evidence-media/msg-125340-kelebihan-kasur-gaji-27778.jpg`
- `evidence-media/msg-131387-yudi-loan-items.jpg`
