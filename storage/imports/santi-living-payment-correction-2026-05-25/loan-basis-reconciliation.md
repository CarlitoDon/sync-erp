# Santi Living Payment Correction - Loan Basis Reconciliation

Date: 2026-05-25
Scope: Santi Living asset purchases from Santi Mebel that were originally treated as the 6-month debt/salary-offset group.
Status: investigation bundle only. Do not mutate Sync ERP from this file without the correction runbook stop gate being cleared.

## Executive Finding

Purchase/order mapping is still clean. The deeper WhatsApp audit now gives a stronger interpretation of the payment issue:

- BG003 / guling 4 is a real Santi Living asset purchase.
- `#60074 Rp180.000` was already visible inside Fajar's official Jurnal loan screenshot.
- On 2026-02-25 Ghana said additions should be paid cash because the monthly installment had already been calculated.
- On 2026-02-26 Mungil paid `Rp180.000` for `guling 4`, then Doni forwarded the receipt to Fahri saying the guling had been paid.
- Later Talenta/Yudi evidence still appears to keep `#60074` inside the official loan list.

So the likely issue is not whether BG003 exists, but whether Santi Mebel failed to remove/apply the separately paid `Rp180.000` before final payoff.

Previous conflict framing:

1. Included in the Santi Mebel debt/loan group:
   - Ghana message `46094` says the receivable for "kasur, bantal, guling" would be divided into 6 payments and auto-deducted via Fajar.
   - Fajar/Yudi evidence lists invoices `#60074`, `#60132`, `#60133`, and `#60136` as the debt that was later paid off, total `Rp9.553.331`.
   - Fajar/Fahri messages `49290`, `49292`, `49297`, and Fajar reply `49303` show the guling 4 pcs was requested to be added to Fajar's notes.
2. Separately paid:
   - Fahri chat message `51499` says "Ri aku sudah bayar ini untuk guling ya".
   - Attached receipt message `51498` is a Jago transfer of `Rp180.000` to Ika Hendrasanti BCA, dated `26 Feb 2026 10:31 WIB`, note `guling 4`, source account Muthia Rahma Syamila.

Because of this, Sync ERP payments should not be voided/recreated yet. The next decision must answer whether Santi Mebel applied transfer `260226SYATIDJ100015140` to invoice `#60074`, or whether `#60074` accidentally remained part of the final loan payoff.

## Basis Reconciliation

### Purchase Basis

| ref | date | item basis | amount |
| --- | --- | --- | ---: |
| P001 | 2026-01-29 | RGE90 x1 | 469.409 |
| P002 | 2026-02-13 | RGE100 x4, RGE160 x2, Springback x7 | 4.076.358 |
| P003 | 2026-02-14 | RGE160 x4, RGE120 x2, Springback x2, Comfy x7, Royal King x1 | 4.827.564 |
| BG003 | 2026-02-20 | Guling Comfy x4 | 180.000 |

Calculation:

```text
P001 + P002 + P003           = Rp9.373.331
BG003                        = Rp180.000
P001 + P002 + P003 + BG003   = Rp9.553.331
```

### Official Loan / Jurnal Basis

Yudi final screenshot message `131387` and Fajar evidence show the official debt group as:

| invoice | mapped ref | amount | note |
| --- | --- | ---: | --- |
| #60074 | BG003 | 180.000 | Listed as "NINO - RUSITA"; matches guling 4 amount. |
| #60132 | P001 | 469.409 | Listed as sewa kasur Santi Living / Grand 90 adjusted price. |
| #60133 | P002 | 4.076.358 | Grand 100, Grand 160, Springback. |
| #60136 | P003 | 4.827.564 | Grand 160, Grand 120, Comfy, Royal King. |

Calculation:

```text
#60074 + #60132 + #60133 + #60136 = Rp9.553.331
```

### Talenta / Payment Basis

Known schedule and payment evidence:

| component | amount | evidence | interpretation |
| --- | ---: | --- | --- |
| Payroll offset 1 | 1.590.000 | Fajar/Talenta message `93190` | Official Talenta loan installment. |
| Payroll offset 2 | 1.590.000 | Fajar/Talenta message `93190` | Official Talenta loan installment. |
| Payroll offset 3 | 1.590.000 | Balance-derived from Talenta and final payoff | No standalone payslip found. |
| Final payoff | 4.783.331 | Fajar balance message `122654`; Jago receipt `122773` | Direct Santi Living operational cash transfer to Santi Mebel. |

Calculation:

```text
3 x Rp1.590.000 + Rp4.783.331 = Rp9.553.331
Rp4.783.331 - (3 x Rp1.590.000) = Rp13.331
```

The `Rp13.331` / `Rp13.332` issue is not a standalone purchase. It is a residual created by the official Talenta/Jurnal rounded schedule.

## Drift Reconciliation

User clarification: the intended simple business installment was `Rp1.562.222` per month. The `Rp27.778` monthly difference was a Talenta input drift corrected through Rani-to-Doni transfers and then used for Rumah Cemoro household flow, not Santi Living operating cash.

Calculation against P001-P003 only:

```text
P001 + P002 + P003                  = Rp9.373.331
6 x Rp1.562.222                     = Rp9.373.332
rounding difference                 = Rp1
first 3 correct installments         = Rp4.686.666
exact remaining 3 installments       = Rp4.686.665
```

Calculation against official loan including BG003:

```text
P001 + P002 + P003 + BG003           = Rp9.553.331
6 x Rp1.562.222                      = Rp9.373.332
difference                           = Rp179.999
```

This means `Rp1.562.222/month` reconciles cleanly to P001-P003, not to P001-P003 plus BG003. If BG003 is kept inside the Santi Mebel loan group, the payment basis must explain how the `Rp180.000` guling amount was settled.

## Evidence Register

| evidence id | date | chat | message id | amount | meaning |
| --- | --- | --- | ---: | ---: | --- |
| E-BG003-INITIAL-BUY | 2026-02-17..2026-02-18 | Admin 2 Sales Santi Mebel | 45500, 45828, 45834, 45832 | 180.000 | Doni asks to buy guling 4, selects guling Comfy, and says "Ambil 4". |
| E-GHANA-TERMS | 2026-02-18 | mas ghana | 46094 | - | Says receivable for kasur, bantal, guling would be divided into 6 payments and auto-deducted via Fajar. |
| E-FAJAR-INITIAL-LOAN | 2026-02-23 | Fajar Sudrajad HRD | 49244 | 9.553.331 | Fajar screenshot already shows `#60074 Rp180.000` and total unpaid `Rp9.553.331`; screenshot timestamp is 18/02/2026. |
| E-BG003-REQUEST | 2026-02-23 | Fajar / Sales Olshop / Fahri | 49290, 49292, 49297, 49303 | 180.000 | User requests guling Comfy 4 pcs @45.000 to be added to Fajar notes; Fajar replies ok. |
| E-GHANA-CASH-ADDON | 2026-02-25 | mas ghana | 51312, 51311, 51319 | 180.000 | Ghana asks if guling is being added again and says additions should be cash because the monthly installment had already been calculated; Doni says he will transfer tomorrow. |
| E-INTERNAL-CLEAN-MONTHLY | 2026-02-26 | Mungilku Cintaku / INTERNAL Santi Living | 51476, 51478 | 1.562.222/month | Clean monthly basis is recorded after the cash-addition discussion. |
| E-BG003-SEPARATE-TRANSFER | 2026-02-26 | Fahri pribadi Marketing | 51498, 51499 | 180.000 | Jago receipt from Muthia to Ika, note guling 4; message says it was paid for guling. |
| E-FAJAR-JURNAL | 2026-02-23 | Fajar Sudrajad HRD | 49244, 49245, 49252 | 9.553.331 | Jurnal/Talenta loan basis and "dipotong 6 kali" context. |
| E-FAJAR-TALENTA | 2026-04-20 | Fajar Sudrajad HRD | 93190 | 1.590.000 x 2, remaining 6.373.331 | Talenta loan screen confirms official schedule state. |
| E-FAJAR-PAYOFF | 2026-05-15 | Fajar Sudrajad HRD | 122654, 122773 | 4.783.331 | Remaining balance and final Jago payoff receipt. |
| E-YUDI-FINAL-LIST | 2026-05-25 | Yudi Keuangan SM | 131382-131387 | 9.553.331 | Yudi frames these as the debt "yang kemaren jadi utang dan udah di lunasin" and sends invoice list. |

## Current Conclusion

Mapped orders remain clean:

- P001-P003 are the mattress/pillow loan group totaling `Rp9.373.331`.
- BG003 is real Santi Living guling purchase totaling `Rp180.000`.
- Total official Santi Mebel debt list is `Rp9.553.331`.

Payment correction is now clearer, but still needs one external confirmation before ERP mutation. Superseding user clarification on 2026-05-26: the `Rp27.778/month` correction is a mattress price miscalculation correction, not a guling correction. Do not net it into BG003.

- The best WhatsApp-based reading is that BG003 was paid separately on `2026-02-26`.
- Santi Mebel/Talenta/Yudi still appear to include `#60074` in the final loan payoff.
- If Santi Mebel confirms the separate transfer was not applied to `#60074`, the guling-specific correction/refund candidate is `Rp180.000`.
- The mattress price drift correction is separate: `Rp27.778 x 6 = Rp166.668`, with already-refunded and pending months tracked separately.
- `Rp13.331/Rp13.332` remains a schedule residual, not a purchase line and not the primary correction logic.

Stop before mutating Sync ERP until Santi Mebel confirms whether transfer `260226SYATIDJ100015140` was applied to `#60074`.
