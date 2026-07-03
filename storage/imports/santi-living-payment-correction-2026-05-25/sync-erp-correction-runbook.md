# Sync ERP Correction Runbook - Santi Living Payment Drift

Date: 2026-05-25
Mode: read-only until stop gate is cleared.
Preferred mutation method after approval: app/API/MCP `void + recreate`, not raw DB patch.

## Stop Gate

Do not change Sync ERP yet. First answer these two questions with evidence:

1. Was Jago transfer `260226SYATIDJ100015140` for `Rp180.000`, note `guling 4`, applied by Santi Mebel to invoice `#60074 / BG003`?
2. Did Fajar/Yudi's final balance `Rp4.783.331` already net off that `Rp180.000` transfer, or did it still include `#60074` as part of the loan payoff?

Deep WhatsApp evidence now strongly suggests the transfer was intended as separate BG003 payment. Superseding user clarification on 2026-05-26: the `Rp27.778/month` drift is a mattress price correction, not a guling correction. Therefore if Santi Mebel confirms the transfer was not applied to `#60074`, the guling-specific correction/refund candidate is `Rp180.000`.

If the answer is contradictory or cannot be verified, leave Sync ERP as-is and add an evidence note only.

## Current Operational Data To Preserve

Do not alter:

- Purchase lines, quantities, item dates, or unit counts.
- Asset mapping: mattress total 22; Springback 20; Comfy pillows 16; Royal King 5; Comfy bolsters 4.
- Cash/lunas purchases outside the early loan group: P004, BG005, P005, P006, BG007, P007.
- Attachments/evidence already linked to purchase refs.

## Read-Only Preflight Before Any Future Mutation

Run through Carla or direct MCP/API read-only tools:

```text
company_list
partner_list
product_list
purchase_order_list
bill_list
payment_list
cash_bank_account_list
payment_method_list
```

Checks:

- Exact company is `Santi Living`.
- No duplicate `SL-SM-*` payment refs.
- Current loan-group payments still total `Rp9.553.331`.
- No `SL-SM-*` payment journal credits Inventory.
- MCP payment tools support `businessDate`.
- `payment_void` exists and creates reversal journals instead of direct deletion.

## Scenario A - Official Loan Includes BG003

Use this only if Santi Mebel confirms `#60074 / BG003` remained inside the official loan balance.

Action:

- Keep current AP settlement amount `Rp9.553.331`.
- Do not reduce Sync ERP AP payments by the `Rp83.334` drift.
- Treat the three `Rp27.778` Rani corrections as personal/household correction flow, not Santi Living cash.
- Add a note/evidence attachment explaining why Talenta used `Rp1.590.000` while the internal simple estimate was `Rp1.562.222`.

Accounting implication:

- AP remains closed.
- Bank/owner contribution split remains based on actual Santi Mebel loan/payoff evidence.
- No Sync ERP payment mutation is needed unless payment accounts/journals still point to the wrong GL account.

## Scenario B - BG003 Was Paid Separately

This is now the recommended scenario after deep WhatsApp audit, but still requires Santi Mebel confirmation before mutation. Use it if Santi Mebel confirms the `26 Feb 2026` transfer settled `#60074 / BG003` separately, or confirms that it should have settled it.

Target AP allocation:

```text
P001-P003 principal                  = Rp9.373.331
Payroll offset 1                     = Rp1.562.222
Payroll offset 2                     = Rp1.562.222
Payroll offset 3                     = Rp1.562.222
Final exact P001-P003 AP settlement  = Rp4.686.665
BG003 separate payment               = Rp180.000
Total purchase settlement            = Rp9.553.331
```

Important: do not mix the mattress price drift with BG003. If #60074 stayed in Talenta payoff after the separate transfer, handle the `Rp180.000` as one of:

- supplier refund/receivable from Santi Mebel, if refund is requested/received;
- supplier credit/advance if Sync ERP supports it;
- explicit rounding/adjustment only if the user chooses that policy and the evidence supports it.

The mattress price drift is a separate correction:

```text
monthly mattress price drift     = Rp27.778
total 6-month correction          = Rp166.668
first 3 months if already refunded = Rp83.334
last 3 months if pending           = Rp83.334
```

Do not simply change the bank payment down to `Rp4.686.665` without preserving the actual bank transfer evidence, because that would break cash/bank audit trail.

Draft mutation sequence after approval:

1. Void old loan-group payments:
   - salary/owner offsets totaling `Rp4.770.000`;
   - final payoff payment `Rp4.783.331`.
2. Recreate payroll/owner contribution payments:
   - `SL-SM-PAYROLL-001-CORRECTED`, `2026-02-27`, `Rp1.562.222`;
   - `SL-SM-PAYROLL-002-CORRECTED`, `2026-03-27`, `Rp1.562.222`;
   - `SL-SM-PAYROLL-003-CORRECTED`, date per final evidence or `2026-04-27`, `Rp1.562.222`.
3. Recreate/apply BG003 payment:
   - `SL-SM-BG003-MUTHIA-TRANSFER`, `2026-02-26`, `Rp180.000`;
   - evidence messages `51498`, `51499`;
   - use owner/family contribution clearing or reimbursement clearing, not Santi Living bank, unless the user chooses to treat Muthia's account as reimbursed by Santi Living.
4. Recreate final payoff with split handling:
   - AP allocation `Rp4.686.665`;
   - actual bank transfer `Rp4.783.331`;
   - difference `Rp96.666` as supplier refund/receivable/advance.

## Scenario C - Drift-Only Correction

This matches the user's immediate intuition of refunding `3 x Rp27.778 = Rp83.334`, but it is not fully clean unless the `Rp13.331/Rp13.332` residual is also classified.

Calculation:

```text
Old final transfer                   = Rp4.783.331
Less 3-month drift                   = Rp83.334
Drift-only corrected final            = Rp4.699.997
Exact P001-P003 remaining             = Rp4.686.665
Residual still unexplained            = Rp13.332
```

Do not implement Scenario C without a posting line for the residual.

## Verification After Any Future Mutation

Required app/MCP read-back:

```text
bill_list
payment_list
cash_bank_account_list
payment_method_list
inventory_stock_levels
rental_item_list
rental_units_by_item
attachment_list
```

Required DB-level checks:

- Purchase total remains `Rp16.485.627`.
- Early loan purchase scope still totals `Rp9.553.331` including BG003 or `Rp9.373.331` plus separate BG003, depending on selected scenario.
- All bills in selected scope are paid or intentionally open with a documented reason.
- No payment journal credits `1200 Inventory`.
- Bank Jago, owner/payroll clearing, and supplier receivable/refund accounts reconcile to the selected correction CSV.
- AP `2100` and GRNI `2105` scoped to `SL-SM-*` net to zero unless unresolved mapping is intentionally left open.

## App Improvement Recommended

This use case exposes a missing business feature:

- supplier overpayment/refund handling;
- split payment allocation between AP and supplier receivable/advance;
- evidence-linked correction notes without mutating purchase quantities.

Without this feature, using only a lower recreated payment amount can make the accounting look clean while losing the actual bank transfer audit trail.
