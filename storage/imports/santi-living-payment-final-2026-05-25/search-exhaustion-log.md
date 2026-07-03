# Search Exhaustion Log

Date: 2026-05-25

## P006 Search Coverage

Target: find direct payment proof for P006 Rp1,616,000 covering RGE 90 biru 1, RGE 100 biru 1, and Bantal Springback 3.

Correction after manual WhatsApp screenshot review: P006 payment proof exists in `Sales Olshop Santi Mebel` msg `92508` as an image-only Jago receipt. The local SQLite text search missed it because the searchable message text/title only says `Sudah tak bayar ya`; the amount, transfer ID, and note are inside the image, not OCR text.

Searches run against WhatsApp `ChatStorage.sqlite`, not WhatsApp UI:

| Search | Date range | Result count | Conclusion |
| --- | --- | ---: | --- |
| Exact P006 amount/item terms: `1.616`, `1616000`, `grand 90`, `grand 100`, `springback 3` | 2026-04-18..2026-05-20 | 7 | Only purchase/order/delivery context; no transfer/Jurnal/bank mutation. |
| Adjacent message review after `Total 1.616` | 2026-04-19 | 2 | Found msg `92474` asking rekening and msg `92508` image receipt Rp1.616.000. |
| `Kiriman bukti transfer` + `Doni` | 2026-04-18..2026-05-20 | 2 | Found BG007 Rp400.000 and P007 Rp793.000 only; no P006. |
| Priority chats broad scan: Sales Olshop, Ghana, Kiriman bukti transfer, Rani, Santi Mebel Hp Keuangan, grup keuangan, Fajar | 2026-04-18..2026-05-20 | 1731 broad hits reviewed by targeted filters | Initial targeted filters missed the image-only receipt; corrected by adjacent media inspection. |

Corrected conclusion: P006 is `cash/lunas`, paid Rp1.616.000 on 2026-04-19 07:57 WIB via Jago transfer to BCA Ika Hendrasanti. Evidence: Sales Olshop msg `92508`, media `jago_transfer_p006_msg_92508.jpg`, transfer ID `260419SYATIDJ100005822`, receipt note `kasur 2 bantal 3`.

## Third Payroll Deduction Search Coverage

Target: find standalone evidence for the third Rp1,590,000 deduction after the 2026-04-20 Talenta screenshot and before the 2026-05-15 final transfer.

| Search | Date range | Result count | Conclusion |
| --- | --- | ---: | --- |
| Targeted gaji Dhoni terms: `gajian mas dhoni april`, `gaji mas dhoni`, `potongan kasur`, `tagihan kasur` | 2026-04-01..2026-05-15 | 3 | Found Apr/May salary context but no standalone Rp1.590.000 Santi Mebel deduction. |
| Exact/near Rp1.590.000 terms plus Talenta/gaji/potong | 2026-04-20..2026-05-15 | 109 | Mostly unrelated customer payments or aggregate payroll messages; no standalone Dhoni deduction proof. |
| Direct Fajar thread | 2026-04-20..2026-05-15 | reviewed | Shows final remaining balance Rp4.783.331 and final transfer proof; supports derived third deduction but not standalone slip. |

Strict conclusion: third deduction stays `balance_derived`, because the equation closes exactly but the standalone payroll slip/attachment was not available locally.

## Attachment Availability Notes

- Several payroll PDF messages have `ZFILESIZE` but empty `ZMEDIALOCALPATH`, so the local WhatsApp DB does not expose a readable file path for those attachments.
- The accessible May 1 internal image `Gajian mas dhoni april 2026` is a Jago movement of Rp236.250 from Operasional Santi Living, not proof of the Santi Mebel Rp1.590.000 deduction.
