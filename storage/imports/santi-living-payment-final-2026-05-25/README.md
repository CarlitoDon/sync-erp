# Santi Living Payment Investigation Final Bundle

Date: 2026-05-25

## Summary

Final investigation scope contains 10 purchase refs with purchase baseline total Rp16,981,114. The initial Santi Living debt is evidenced from Fajar/Talenta/Santi Mebel records, but Santi Living accounting treats the salary-offset installments as Doni capital contribution, not Santi Living payroll.

| Bucket | Purchase refs | Purchase total | Payment/accounting basis |
| --- | --- | ---: | ---: |
| initial_santi_mebel_debt | P001, P002, P003, BG003 | Rp10,048,818 | Rp9,553,331 |
| cash/lunas | P004, BG005, P005, P006, BG007, P007 | Rp6,932,296 | Rp6,932,296 |
| unknown | none | Rp0 | Rp0 |

## Final Findings

- Initial Santi Mebel debt principal is Rp9,553,331 and reconciles exactly to Rp4,770,000 owner contribution via Santi Mebel salary offsets plus Rp4,783,331 Bank Jago payoff from Santi Living operating income.
- Confirmed cash/lunas purchase payments total Rp6,932,296. Bank Jago outflow total is Rp11,715,627 after adding the final payoff.
- P006 Rp1,616,000 is confirmed paid/cash-lunas via Jago transfer receipt in Sales Olshop msg `92508`, transfer ID `260419SYATIDJ100005822`, note `kasur 2 bantal 3`.
- The Rp495,487 difference between initial purchase baseline Rp10,048,818 and loan basis Rp9,553,331 is a pricing-basis mismatch, not an unpaid balance: Fajar/Talenta uses special HPP/Jurnal basis.
- Purchase prices are transaction-specific and can change over time. Do not derive price from SKU/size alone; use the evidence attached to each purchase ref.

## Files

- `payment-investigation-final.csv`: final one-row-per-purchase ledger.
- `payment-events-final.csv`: confirmed and balance-derived payment events.
- `payment-evidence-media-manifest.csv`: evidence files copied into this bundle.
- `image-evidence-curated-mapping.md` and `.csv`: reviewed image/OCR evidence that supports purchase/payment mapping.
- `image-evidence-ocr-scan.csv`: raw OCR scan over candidate WhatsApp images; includes false positives and should not be used directly for ERP posting.
- `image-evidence-ocr-supporting.csv`: automated filtered OCR hits; still requires review before posting.
- `image-evidence-curated/`: copied reviewed image evidence files.
- `p006-search-hits.csv`: P006 search hits and interpretation.
- `installment-third-search-hits.csv`: third-installment search hits and interpretation.
- `search-exhaustion-log.md`: query coverage and remaining gaps.
- `sync-erp-posting-recommendation.md`: recommended ERP correction steps.

## Validation

| Check | Expected | Actual | Result |
| --- | ---: | ---: | --- |
| Purchase scope total | Rp16,981,114 | Rp16,981,114 | pass |
| Initial Santi Mebel debt basis | Rp9,553,331 | Rp9,553,331 | pass |
| Owner contribution via Santi Mebel salary offset | Rp4,770,000 | Rp4,770,000 | pass |
| Bank Jago operating/cash payments | Rp11,715,627 | Rp11,715,627 | pass |
| Confirmed cash/lunas total | Rp6,932,296 | Rp6,932,296 | pass |
| Unknown purchase total | Rp0 | Rp0 | pass |
