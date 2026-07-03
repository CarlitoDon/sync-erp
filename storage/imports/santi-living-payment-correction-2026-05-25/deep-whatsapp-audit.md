# Deep WhatsApp Audit - BG003 / #60074 / Payment Drift

Date: 2026-05-25
Source: WhatsApp SQLite read-only scan, media inspection, and existing extracted evidence.
Scope: determine whether BG003 / invoice #60074 Rp180.000 was part of the installment loan or paid separately.

## Updated Finding

The deeper WhatsApp audit changes the weighting of evidence.

Superseding user clarification on 2026-05-26: the `Rp27.778/month` Rani correction is a mattress price miscalculation correction, not a guling correction. Therefore the mattress price drift and the BG003/guling `Rp180.000` possible double payment must be handled as two separate issues.

Earlier, BG003 looked simply conflicted. After reading the chronological chat context, the stronger interpretation is:

- `#60074 / Rp180.000` was already visible inside Fajar's official Jurnal loan screenshot.
- Doni/Mungil later calculated the clean installment at `Rp1.562.222/month`, which reconciles to P001-P003 only.
- Ghana then explicitly said additions should be cash because the monthly installment had already been calculated.
- Mungil paid `Rp180.000` for `guling 4` on 2026-02-26 and Doni forwarded the receipt to Fahri saying it had been paid for guling.
- Later Talenta/Yudi evidence still appears to keep the official loan basis at `Rp9.553.331`, which includes `#60074`.

So the most likely accounting issue is not "is BG003 real?" BG003 is real. The issue is that BG003 was likely paid separately, while Santi Mebel's loan/payoff basis still included it.

## Critical Timeline

| date/time | chat | msg id | evidence | implication |
| --- | --- | ---: | --- | --- |
| 2026-02-17 13:22 | Admin 2 Sales Santi Mebel | 45500 | Doni: "Mau beli guling 4" | Starts guling purchase trail. |
| 2026-02-18 07:38 | Admin 2 Sales Santi Mebel | 45828, 45834, 45832 | Doni selects the guling and says "Ambil 4" / "Tak ambil skrg bisa?" | Guling purchase was initiated before the official loan screenshot. |
| 2026-02-18 14:56 | mas ghana | 46094 | Ghana says receivable "kasur, bantal, guling" will be divided into 6 payments and auto-deducted via Fajar. | Early intent was to include guling in loan. |
| 2026-02-23 09:25 | Fajar Sudrajad HRD | 49244 | Jurnal screenshot shows total unpaid `Rp9.553.331` and includes `#60074 Rp180.000`, screenshot timestamp 18/02/2026. | Official loan basis already includes a Rp180.000 invoice before Doni asks Fahri to add guling. |
| 2026-02-21 12:38 | INTERNAL Santi Living | 48230, 48272 | Internal team says "ini belom guling ya" and "tolong masukin guling 4 ya mas". | Internal tracking thought guling was missing, creating later confusion. |
| 2026-02-23 09:41-09:51 | Fajar / Sales Olshop / Fahri | 49290, 49292, 49297, 49303 | Doni asks that guling Comfy 4 pcs @45.000 be added to Fajar notes; Fajar replies ok. | Doni believed guling needed to be added, even though Fajar screenshot likely already included #60074. |
| 2026-02-25 17:57-19:43 | mas ghana | 51312, 51311, 51319 | Ghana: "Nambah guling lagi?" then "Nek tambahan2 e cash dlu gimana? Soale kmrn udh dihitung cicilan perbulan e"; Doni: "Besok tak tf e". | Strong evidence that after monthly installment was calculated, guling/additions were to be paid cash. |
| 2026-02-26 10:29-10:30 | Mungilku Cintaku / INTERNAL Santi Living | 51476, 51478 | Mungil sends `1,562,222`; internal group records "Cicil Per Bulan ... Rp1,562,222". | Clean monthly business basis is P001-P003 only. |
| 2026-02-26 10:30 | Mungilku Cintaku | 51479, 51480 | Mungil asks "180 ya?" and sends Jago receipt Rp180.000 to Ika, note `guling 4`. | Direct evidence of separate guling payment. |
| 2026-02-26 10:49 | Fahri pribadi Marketing | 51498, 51499 | Doni forwards the same receipt to Fahri: "Ri aku sudah bayar ini untuk guling ya". | Payment was communicated to Santi Mebel sales. |
| 2026-04-20 | Fajar Sudrajad HRD | 93190 | Talenta loan screen still uses official loan schedule. | Suggests Santi Mebel/Talenta loan did not remove #60074. |
| 2026-05-15 | Fajar Sudrajad HRD | 122654, 122773 | Remaining `Rp4.783.331` and final Jago payoff. | Final payoff follows official remaining balance. |
| 2026-05-25 | Yudi Keuangan SM | 131382-131387 | Yudi sends final debt invoices including `#60074`, `#60132`, `#60133`, `#60136`. | Official Santi Mebel debt list still includes #60074. |

## Reconciliation After Deep Audit

Clean business basis:

```text
P001 + P002 + P003                 = Rp9.373.331
6 x Rp1.562.222                    = Rp9.373.332
rounding difference                = Rp1
```

BG003 separate payment:

```text
BG003 / guling 4                   = Rp180.000
payment evidence                   = Jago transfer 260226SYATIDJ100015140
date/time                          = 26 Feb 2026 10:31 WIB
```

Official Santi Mebel/Talenta basis:

```text
#60074 + #60132 + #60133 + #60136 = Rp9.553.331
```

After the 2026-05-26 clarification, do not net the mattress price drift into the BG003/guling analysis. Treat them separately:

```text
Issue A - mattress price drift:
Rp27.778 x 6 months                = Rp166.668 total correction
first 3 months if already refunded = Rp83.334 already corrected personally
last 3 months if not refunded      = Rp83.334 still to request/record

Issue B - BG003/guling possible double payment:
separate transfer                  = Rp180.000
if #60074 stayed in Talenta payoff  = Rp180.000 double-count/refund candidate
```

The previous `Rp96.666` net framing should not be used as the main correction logic after this clarification. It mixed the mattress price drift with the guling payment issue.

The `Rp13.331/Rp13.332` residual remains a schedule/reconciliation artifact, not a standalone purchase and not proof of a guling adjustment.

## Practical Interpretation

For Sync ERP, the operational purchase mapping stays:

- P001-P003: installment purchase group, `Rp9.373.331`.
- BG003: real guling asset purchase, `Rp180.000`.

For payment correction, the best current mapping is:

- The mattress price drift correction is `Rp27.778/month x 6`, separate from guling.
- BG003 should be a separate payment dated `2026-02-26` with receipt `260226SYATIDJ100015140` if Santi Mebel confirms it settled #60074.
- If #60074 remained in Talenta payoff after that transfer, the guling-specific refund/receivable candidate is `Rp180.000`.
- Any remaining `Rp27.778/month` drift refunds should be recorded as mattress price adjustment/vendor credit/refund, not as guling correction.

## Remaining Confirmation

The only thing still worth confirming with Santi Mebel is not "did Doni pay Rp180.000?" He did. The evidence is strong.

The question is:

> Did Santi Mebel apply transfer `260226SYATIDJ100015140` to invoice `#60074`, or did #60074 accidentally remain inside the final loan payoff?

If they confirm it remained in the final payoff, then after the 2026-05-26 clarification use two separate correction tracks:

- guling double-count candidate: `Rp180.000`;
- mattress price drift correction: `Rp166.668` total across six months, with the already-refunded and pending months tracked separately.

Do not use the older `Rp96.666` net framing. It mixed the mattress price correction with the guling double-count question.
