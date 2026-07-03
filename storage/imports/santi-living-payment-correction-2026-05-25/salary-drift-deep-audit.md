# Salary Drift Deep Audit - Rp27.778/month

Date: 2026-05-26
Source: WhatsApp SQLite read-only scan.
Scope: explain why Santi Mebel/Rani transferred `Rp27.778` per month for six months.

## Conclusion

The strongest supported explanation is:

> Santi Mebel payroll/Talenta initially used the practical salary-deduction amount around `Rp1.590.000/month`, while the corrected clean Santi Living installment basis was `Rp1.562.222/month`. The monthly difference is `Rp27.778`, so Santi Mebel returned that amount to Doni as "kekurangan gaji".

This is a mattress/HPP price correction issue, not the `BG003/#60074 Rp180.000` guling issue.

## Price/HPP Cause Found

Deeper WhatsApp scan found the direct price/HPP issue:

> The RGE mattress HPP originally taken from admin/Jurnal was too high because Jurnal did not reflect the real HPP from the `buy 10 get 1 bonus` program. Ghana said RGE should use the red/rightmost HPP price, and that the calculation should be cheaper.

This explains why the mattress installment basis needed correction. It does not, by itself, spell out the exact `Rp27.778` transfer label; the `Rp27.778` link is still the numeric bridge between `Rp1.590.000` and `Rp1.562.222`.

Example derived from the chat prices:

```text
RGE 100 admin/Jurnal HPP             Rp590.040
Corrected 10/11 HPP                  Rp536.400

RGE 160 admin/Jurnal HPP             Rp869.417
Corrected 10/11 HPP                  Rp790.379
```

## Calculation

```text
Wrong/early payroll deduction basis       Rp1.590.000/month
Correct clean installment basis           Rp1.562.222/month
Monthly drift/refund                      Rp27.778/month
6-month drift at flat monthly refund      Rp166.668
```

Clean purchase basis without guling:

```text
P001 + P002 + P003                        Rp9.373.331
Rp9.373.331 / 6                           Rp1.562.221,833...
Practical monthly amount                  Rp1.562.222
6 x Rp1.562.222                           Rp9.373.332
Rounding difference                       Rp1
```

So if the correction is posted strictly against the principal, the six-month total drift is `Rp166.669` when compared with `6 x Rp1.590.000`. If it follows the actual flat refunds found in WhatsApp, it is `Rp27.778 x 6 = Rp166.668`, with `Rp1` left as rounding.

## Evidence Chain

| date/time | chat | msg id | evidence | implication |
| --- | --- | ---: | --- | --- |
| 2026-02-12 09:56 | Admin 2 Sales Santi Mebel | 41435 | RGE100 `590.040`, RGE160 `869.417`, Springback `60.000`, labeled as HPP | Initial admin/Jurnal-style price basis. |
| 2026-02-14 20:08 | mas ghana | 43459-43465 | "kamu salah", "Hitung", "Kudune lebih murah", "RGE ... hpp ne harga merah paling kanan" | Direct evidence that the RGE mattress price calculation was wrong and should be cheaper. |
| 2026-02-14 20:09 | mas ghana | 43468-43473 | Admin does not know HPP; Jurnal is not real HPP | Direct evidence that admin/Jurnal price should not be treated as final HPP. |
| 2026-02-14 20:10 | mas ghana | 43474, 43477, 43478 | "Program pembelian 10 bonus 1"; Jurnal only counts 10 units and not the bonus unit | Direct mechanism for why real RGE HPP is lower. |
| 2026-02-15 18:25 | mas ghana | 44305 | "hpp udh dibenerin blm?... Biar lbh ringan juga cicilanmu" | Root business issue was HPP/price correction affecting installment amount. |
| 2026-02-15 18:26 | mas ghana | 44308 | Doni says he will clarify "hpp yang bener dan term cicilan" with Jingga/Fahri. | Doni knew the installment needed corrected HPP/price basis. |
| 2026-02-23 09:26 | Fajar Sudrajad HRD | 49252 | "berarti sekitar 1,59 perbulan potongane" | HR/payroll side used the early practical amount around `Rp1.590.000/month`. |
| 2026-02-26 10:29 | Mungilku Cintaku | 51476 | "1,562,222" | Corrected monthly amount appears before first salary correction transfer. |
| 2026-02-26 10:30 | INTERNAL Santi Living | 51478 | "Cicil Per Bulan ... Februari - Juli 2026 ... Rp1,562,222" | Internal Santi Living tracking uses corrected clean monthly installment. |
| 2026-02-28 10:41 | Ibuk | 53686 | "Dikurangi tagihan kasur santi mebel 1,562,222" | Same corrected amount used in personal cashflow context. |
| 2026-02-28 14:07 | Rumah Cemoro | 53882 | "TJP (ganti santi kasur) 1,562,222" | Same corrected amount repeated again. |
| 2026-03-03 08:58 | Jingga AR Santi Mebel | 56161 | "kekurangan gaji tf nanti ya" | Santi Mebel acknowledges salary shortfall/refund. |
| 2026-03-03 15:53 | Rani Santi Mebel | 56671 | Transfer to Khusnudhoni `Rp27.778` | First evidenced monthly correction payment. |
| 2026-03-03 16:42 | grup keuangan berdelapan | 56801 | `03 maret kekurangan gaji mas dhoni 27.778.pdf` | Back-office labels the payment as salary shortfall. |
| 2026-03-31 16:36 | Rani Santi Mebel | 77856 | Transfer to Khusnudhoni `Rp27.778` | Second evidenced correction payment. |
| 2026-04-02 10:20 | grup keuangan berdelapan | 79439 | `31 maret kekurangan gaji mas dhoni 27.778.pdf` | Back-office repeats the same label. |
| 2026-05-02 15:18 | Rani Santi Mebel | 106402 | Transfer to Khusnudhoni `Rp27.778` | Third evidenced correction payment. |
| 2026-05-02 16:59 | grup keuangan berdelapan | 106560 | `02 mei kekurangan gaji mas dhoni 27.778.pdf` | Back-office repeats the same label. |

## What This Does And Does Not Prove

Proved:

- The `Rp27.778` amount equals the exact monthly gap between `Rp1.590.000` and `Rp1.562.222`.
- There is direct WhatsApp evidence that the RGE mattress HPP calculation was wrong: Ghana says the calculation should be cheaper, admin/Jurnal does not reflect real HPP, and the `10 bonus 1` program was not counted in Jurnal.
- At least three `Rp27.778` transfers are present in WhatsApp: 2026-03-03, 2026-03-31, and 2026-05-02.
- The transfer was labeled as `kekurangan gaji`, not as a Santi Living customer payment and not as a guling payment.
- The prior chat context supports a corrected HPP/price basis as the reason the installment needed to be lighter.

Not fully proved from chat text alone:

- A single message explicitly saying "Rp27.778 is because the RGE HPP/10+1 calculation was miscalculated."
- A line-by-line final worksheet that ties the `Rp166.668/Rp166.669` total drift to each mattress size after all revisions. The mechanism and amounts are strongly supported, but the final reconciliation is still assembled from multiple messages.

## ERP Implication

Do not change the purchase/order mapping:

- P001-P003 remain the installment purchase group at `Rp9.373.331`.
- BG003 remains a separate guling purchase/payment issue at `Rp180.000`.

For payment correction:

- Treat the first three `Rp27.778` transfers as personal salary correction/refund from Santi Mebel to Doni, not Santi Living operating income.
- If Santi Mebel still deducts/settles based on the wrong amount for the final three months, Doni should request another `3 x Rp27.778 = Rp83.334` refund, with possible `Rp1` rounding depending on whether the final schedule is reconciled to exact principal.
- In Sync ERP, this should not be posted as a Santi Living bill payment unless Doni explicitly wants to record owner-level capital/refund flows. Operationally, the Santi Living purchase cost basis stays clean.
