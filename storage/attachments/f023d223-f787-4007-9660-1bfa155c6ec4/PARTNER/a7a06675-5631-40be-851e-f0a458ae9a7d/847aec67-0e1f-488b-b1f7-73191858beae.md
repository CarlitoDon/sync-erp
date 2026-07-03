# Santi Living - WhatsApp purchase extraction for Santi Mebel mattresses

Snapshot source: `/tmp/wa-santi-living-purchases-20260524/ChatStorage.sqlite`

Scope: WhatsApp chats including Ghana, Fahri Marketing, Sales Olshop Santi Mebel, Admin Santi Mebel, internal Santi Living, and payment context. Customer rental invoices and Santi Mebel retail customer payments were excluded from the kasur purchase total.

Normalization applied: every Santi Living mattress is recorded as `Royal Grand Exclusive (RGE)` and color `biru`, following the user's correction. Where a source PDF says another color, it is kept in notes only.

## Result

- Total RGE mattresses found: **22 pcs**
- 100x200: **6 pcs**
- 120x200: **6 pcs**
- 160x200: **6 pcs**
- 90x200: **4 pcs**
- Mattress amount with exact + estimated lines: **Rp 14.926.714**
- Exact mattress amount from invoice/chat/Jurnal lines: **Rp 10.507.750**
- Estimated mattress amount where invoice file was not available: **Rp 4.418.964**

## Purchase Groups

| Group | Date | Kasur | Amount basis | Key evidence |
|---|---:|---:|---|---|
| P001 | 2026-01-29 | 1 | Rp 500.860 (invoice_exact) | Sales Olshop Santi Mebel msg 32135-32445; INTERNAL Santi Living msg 32434-32447 |
| P002 | 2026-02-13 | 6 | Rp 4.098.994 (invoice_exact) | Admin 2 Sales Santi Mebel msg 41372-42317; Jimas R msg 41368-41401; Bintang Display msg 42340-42557 |
| P003 | 2026-02-14 | 6 | Rp 4.418.964 (hpp_estimate_from_msg_48334) | Yulia Santi Mebel Salis msg 43573-43709; INTERNAL Santi Living msg 44716-44825; Bintang Display msg 44599 |
| P004 | 2026-03-19 | 4 | Rp 2.514.896 (invoice_thumbnail_exact) | Admin Santi Mebel Berjo msg 68526-68616; Jingga AR Santi Mebel msg 68610-68640; mas ghana msg 68601-68749 |
| P005 | 2026-04-03 | 2 | Rp 1.134.000 (chat_and_jurnal_exact) | Sales Olshop Santi Mebel msg 80315-80470; Jimas R msg 80420-80434; Kiriman bukti transfer msg 80480 |
| P006 | 2026-04-18 | 2 | Rp 1.466.000 (chat_exact) | Sales Olshop Santi Mebel msg 92161-92286; mas ghana msg 92183-92204; INTERNAL Santi Living msg 92287-92289; Sales Olshop delivery msg 96095-96247 |
| P007 | 2026-05-14 | 1 | Rp 793.000 (whatsapp_chat_and_invoice_exact) | Sales Olshop Santi Mebel msg 121887-121972; Fahri pribadi Marketing msg 121886-121932; Kiriman bukti transfer msg 122036 |

## Notes

- `P003` quantities are confirmed from WhatsApp pickup messages, but no invoice file/thumbnail with amount was available. Its values use the closest HPP reference found in chat.
- `P004` full invoice media URL was expired, but its WhatsApp thumbnail was available and confirms the same RGE 120 amount used in the CSV.
- `P005`, `P006`, and `P007` close the count from 17 to 22 mattresses: Mar 19 Ghana chat says there were 17 kasur after the cash purchase, Apr 3 adds 2, Apr 18 adds 2, and May 14 adds 1.
- `P007` was missed in the first pass because it appears after the May 3 self-recap that said 21 pcs. The WhatsApp chain is: user asked to buy `grand exclusive 100`, Fahri confirmed the price path, Sales Olshop asked `1 tok ya?`, user answered `Betull`, Sales Olshop sent a WhatsApp PDF invoice, and Kiriman bukti transfer says `nama: doni`, `barang: grand exclusive 100`, `jumlah 793.000`, `bank: BCA`.
- May 6 `ibu ika ... dp kasur busa royal grand exclusive uk 100cm` remains excluded because the WhatsApp wording identifies a customer/payment entry, not a Santi Living asset purchase by Doni.
- May 20/21 `Kasur busa 6 x 725` was excluded because context says it was a quotation/order list for someone buying equipment, not Santi Living inventory purchase.

## Output Files

- Kasur-only CSV: `/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-santi-mebel-kasur-purchases-2026-05-24.csv`
- Full line CSV with accessories: `/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-santi-mebel-purchase-lines-2026-05-24.csv`
- Raw extraction folder: `/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/whatsapp-extraction-2026-05-24`
- Copied evidence folder: `/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/evidence/whatsapp-santi-living-purchases-2026-05-24`
