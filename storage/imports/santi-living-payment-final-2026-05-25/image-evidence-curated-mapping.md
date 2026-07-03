# Curated Image Evidence Mapping

Date: 2026-05-25

This file is the reviewed subset of the OCR image scan. The raw OCR scan contains false positives from unrelated retail transfer groups, so ERP posting should use this curated list rather than every raw OCR hit.

## Price Rule

Harga beli Santi Living ke Santi Mebel berubah-ubah. Do not infer a purchase price from SKU, size, or a later/earlier transaction. Use the price evidence attached to each transaction date/ref: invoice/SO image, Jurnal screenshot, transfer note, or chat total for that specific purchase. The same item/size can legitimately have different bases such as original SO price, special HPP/Jurnal basis, or later cash purchase price.

## Curated Images

| refs | evidence | supports | status | file |
| --- | --- | --- | --- | --- |
| P001 | IMG-P001-PRICE-32157 | Jurnal purchase invoice screenshot showing Royal Grand Exclusive 90cm Biru unit price Rp500.860; supports P001 original purchase baseline. | curated_supporting | `image-evidence-curated/p001_price_invoice_msg_32157.jpg` |
| P001;P002;P003 | IMG-LOAN-PRICE-LIST-41696 | Price list/HPP image for Grand Exclusive 20 showing paket 10+1 prices: 90 Rp469.409, 100 Rp536.400, 120 Rp628.724, 160 Rp790.379; supports payroll-loan price basis. | curated_supporting | `image-evidence-curated/initial_loan_hpp_price_list_msg_41696.jpg` |
| P001;P002;P003 | IMG-LOAN-KASUR-LIST-44284 | Spreadsheet screenshot listing 13 Royal Grand mattresses: 1x90, 4x100, 2x120, 6x160; supports initial kasur quantity split. | curated_supporting | `image-evidence-curated/initial_loan_13_kasur_list_msg_44284.jpg` |
| P001;P002;P003 | IMG-LOAN-HPP-CALC-44301 | HPP calculation image: 90x200 Rp469.409 x1; 100x200 Rp536.400 x4; 120x200 Rp628.724 x2; 160x200 Rp790.379 x6; total 13 kasur Rp8.614.731. | curated_supporting | `image-evidence-curated/initial_loan_hpp_calc_13_kasur_msg_44301.jpg` |
| P002;P003;BG003 | IMG-ACCESSORY-LIST-48224 | Accessory spreadsheet image listing Springback, Royal King, and Comfy pillow rows with Feb 13/14 dates; supports bantal purchase mapping when combined with chat text. | curated_supporting_partial_crop | `image-evidence-curated/initial_accessory_list_msg_48224.jpg` |
| P001;P002;P003;BG003 | IMG-LOAN-JURNAL-49244 | Jurnal outstanding screenshot for MAS DONI (WA GHANA), total piutang Rp9.553.331; supports payroll loan principal. | curated_supporting | `image-evidence-curated/payroll_loan_jurnal_outstanding_msg_49244.jpg` |
| P001;P002;P003;BG003 | IMG-LOAN-TALENTA-93190 | Talenta loan detail screenshot showing Rp1.590.000 payments on 2026-02-27 and 2026-03-27 plus remaining Rp6.373.331. | curated_supporting | `image-evidence-curated/payroll_loan_talenta_msg_93190.jpg` |
| P001;P002;P003;BG003 | IMG-LOAN-PAYOFF-122773 | Jago transfer receipt Rp4.783.331, transfer ID 260515SYATIDJ100023688, note pelunasan utang dhoni; supports final loan payoff. | curated_supporting | `image-evidence-curated/payroll_loan_payoff_jago_msg_122773.jpg` |
| P004 | IMG-P004-INVOICE-62205 | Sales invoice #62205 thumbnail for P004; OCR is low quality, kept as image support beside text evidence that payment was marked lunas. | curated_supporting_low_ocr | `image-evidence-curated/p004_sales_invoice_62205_thumb.jpg` |
| BG005 | IMG-BG005-PAY-72129 | Transfer details receipt Rp114.400 to Ika Hendrasanti, transaction ID 260324SYATIDJ100014744, note bantal 4; supports BG005 cash/lunas. | curated_supporting | `image-evidence-curated/bg005_payment_bantal4_msg_72129.jpg` |
| P005 | IMG-P005-INVOICE-63002 | Sales invoice #63002 thumbnail for P005; supports invoice/item mapping beside Jurnal text evidence Rp1.134.000. | curated_supporting_low_ocr | `image-evidence-curated/p005_sales_invoice_63002_thumb.jpg` |
| P006 | IMG-P006-PAY-92508 | Jago transfer receipt Rp1.616.000, transfer ID 260419SYATIDJ100005822, note kasur 2 bantal 3; supports P006 cash/lunas. | curated_supporting | `image-evidence-curated/p006_payment_kasur2_bantal3_msg_92508.jpg` |
| BG007 | IMG-BG007-PAY-112161 | Transfer details receipt Rp400.000 to Ika Hendrasanti, transaction ID 260508SYATIDJ100022891, note 8 bantal dhoni; supports BG007 cash/lunas. | curated_supporting | `image-evidence-curated/bg007_payment_8bantal_msg_112161.jpg` |
| P007 | IMG-P007-INVOICE-65396 | Sales invoice #65396 image for P007; supports invoice/item mapping beside transfer/Jurnal evidence Rp793.000. | curated_supporting | `image-evidence-curated/p007_sales_invoice_65396.jpg` |

## Raw OCR Scan Files

- `image-evidence-ocr-scan.csv`: all 592 candidate image rows.
- `image-evidence-ocr-supporting.csv`: automated keyword/OCR hits; contains false positives and should be reviewed before use.
- `image-evidence-scan/`: OCR text cache by source file hash.

## Important Correction

- P006 is the pattern to avoid repeating: SQLite text search saw only `Sudah tak bayar ya`, but OCR/visual inspection of msg `92508` revealed the actual Rp1.616.000 transfer receipt. Future payment investigations should inspect adjacent image media after any `total`, `rekening`, `sudah bayar`, or `done` messages.
