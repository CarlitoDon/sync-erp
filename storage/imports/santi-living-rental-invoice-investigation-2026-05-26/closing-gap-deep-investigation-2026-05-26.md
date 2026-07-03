# Closing Gap Deep Investigation - 2026-05-26

## Summary

- Total targets: 25
- Investigated: 25 / 25
- Status counts: needs_manual_review: 24, found_partial: 1

## Investigation Log

### Target 1: Cust SL - Aryadi Banguntapan

- **chat_id**: 109165200580843@lid
- **phone**: 628170010902
- **Status**: `needs_manual_review` (confidence: low)
- **Evidence source**: Chrome Profile 1 WhatsApp Web IndexedDB
  - `000641.ldb`: Contact record found with display name "Cust SL - Aryadi Banguntapan", phone 628170010902
  - `000643.ldb`: 3+ message records found with IDs like `true_109165200580843@lid_2A17C80FE99C49DBB27F`, flags show isMediaMsg/isDocMsg but message body is encrypted/binary
- **Invoice text**: NOT FOUND - no readable "INVOICE PEMESANAN", price, date, or item text extractable via strings from any .ldb file
- **Last chat**: 2026-04-11T18:33:38+07:00
- **Action needed**: Manual WhatsApp desktop read or decrypted message extraction to determine if an invoice/order exists for this customer

### Target 2: Group (Down payment label)

- **chat_id**: 120363422057960855@g.us
- **phone**: (empty - group chat)
- **Status**: `needs_manual_review` (confidence: low)
- **Evidence source**: Chrome Profile 1 WhatsApp Web IndexedDB
  - `000638.ldb`: Generic pricelist templates found: "Pricelist Normal", "Paket (Kasur + Sprei + Bantal)", "Single 90 = 35.000", "Bantal: Rp7.000", "Pricelist Kasur Busa Saja", "Single 90 = 25.000"; quick reply templates: "terima kasih sudah sewa di Santi Living"
  - `000641.ldb`: Group chat record exists; "Santi Living Sewa Kasur" contact/group name found
  - `000642.ldb`: "Sales Invoice-63002.pdf" attachment found but belongs to Supriyanto message (target 14), not this group; message "Selamat pagi Pak Supriyanto, mau konfirmasi untuk pengantaran dan penjemputan sewa kasur" is from a different chat
  - Message IDs span multiple senders: 241514785550543@lid, 113087092895929@lid, 123755288363143@lid, 82635489550367@lid
- **Invoice text**: NOT FOUND - only shared pricelist templates and admin quick replies visible; no customer-specific invoice with dates, items, prices, or delivery address
- **Last chat**: 2026-05-26T13:06:29+07:00
- **Action needed**: Manual WhatsApp desktop read to identify which customer this group's "Down payment" label refers to, and extract any invoice/order details from the group messages

## Additional Rental Order Candidates

(empty - no `found_invoice` rows yet)

## Additional Rental Order Lines

(empty - no `found_invoice` rows yet)

### Target 3: Cust SL - Ling Santa Persada Homestay

- **chat_id**: 12889213661255@lid
- **phone**: 6281385097390
- **Status**: `needs_manual_review` (confidence: low)
- **Evidence source**: Chrome Profile 1 WhatsApp Web IndexedDB
  - `000641.ldb`: Contact record found with display name "Cust SL - Ling Santa Persada Hom[estay]", phone partial "85097390"
  - `000638.ldb`: Label association confirmed: `["label_jid","5","12889213661255@lid"]` → label 5 = "Order complete"
  - `000642.ldb`: 16 message records (false_*) from admin user 6289519119092; types: chat (14), pinned_message (1); one image attachment (AC46D62E, image/jpeg); all message body text encrypted/binary
  - `000643.ldb`: 12 message records (true_*) from customer 82635489550367@lid; types: chat (10), vcard (1: "Admin 2 Santi Living" phone 6282241851577), revoked/deleted (1); all message body text encrypted/binary
  - No "INVOICE PEMESANAN" found for this customer; only invoices in IndexedDB belong to M. Lutfi (000643.ldb) and Nisrina (000638.ldb)
- **Sync ERP**: Partner exists (id: 7147e7fb-dc9d-4804-884b-45f84ec1e84a, phone: 6281385097390). No invoice or rental order records found.
- **Invoice text**: NOT FOUND - no readable "INVOICE PEMESANAN", price, date, or item text extractable via strings from any .ldb file
- **Last chat**: 2026-05-01T15:59:54+07:00
- **Action needed**: Manual WhatsApp desktop read or decrypted message extraction to determine if an invoice/order exists for this customer

### Target 4: Cust SL - Misfa Tempel

- **chat_id**: 132392517918962@lid
- **phone**: 6285832714409
- **Status**: `needs_manual_review` (confidence: low)
- **Evidence source**: Chrome Profile 1 WhatsApp Web IndexedDB
  - `000638.ldb`: Contact/name fragments found: "Cust SL - Misfa Tempel", `132392517918962`, phone fragment `3271440`, repeated "Misfa", and text fragment "Kunci Panggilan dan Stempel dl".
  - `000641.ldb`: Contact fragments found around `5832714409` and "Cust SL - Misfa Tempel"; no readable invoice fields nearby.
  - `000642.ldb`: Multiple message metadata records found with IDs like `false_132392517918962@lid_3A0E807CF8E1FF45BE70`; record shows `type=chat`, admin-side user `6289519119092`, but body text is encrypted/binary.
  - `000643.ldb`: Additional status/message metadata found for `132392517918962@lid`, including media/status records; no readable target invoice body.
  - `000638.ldb`: A readable `INVOICE PEMESANAN` fragment was found, but it says `Nama : Nisrina` and `Cust SL - Nisrina Kotagede`, so it is rejected as evidence for Misfa Tempel.
- **Invoice text**: NOT FOUND for this target - no readable Misfa-specific "INVOICE PEMESANAN", price, date, delivery address, or item text extractable via strings.
- **Last chat**: 2026-04-17T10:22:45+07:00
- **Action needed**: Manual WhatsApp desktop read or decrypted extraction before importing this target into Sync ERP. Do not use the Nisrina invoice for Misfa.

### Target 5: Cust SL - Yayoe Jl. Wonosari

- **chat_id**: 133814185685246@lid
- **phone**: 6281248143123
- **Status**: `needs_manual_review` (confidence: low)
- **Evidence source**: Chrome Profile 1 WhatsApp Web IndexedDB
  - `000638.ldb`: Contact/label fragments found: "Cust SL - Yayoe Jl. Wonosari"; label association `["label_jid","6","133814185685246@lid"]`.
  - `000641.ldb`: Contact fragments found with phone suffix `8143123` and name "Cust SL - Yayoe Jl. Wonosari"; nearby strings include "Alhamdulillah....", "mba detik kos annisa", and "kos putri sutarno 1 klebengan", but those are not safely linked to the target because LevelDB interleaves adjacent records.
  - `000642.ldb`: Admin-side message metadata found for `false_133814185685246@lid_*`; records include `type=chat` and one `type=image`, but no readable invoice/order body text.
  - `000643.ldb`: Customer-side message metadata found for `true_133814185685246@lid_*`; no readable invoice/order body text.
  - Readable `INVOICE PEMESANAN` fragments seen in these LevelDB files belong to other customers, not Yayoe/Wonosari, and are rejected as evidence for this target.
- **Invoice text**: NOT FOUND for this target - no readable Yayoe-specific item, date, delivery fee, DP, total, or invoice text extractable from the local WhatsApp Web IndexedDB strings.
- **Last chat**: 2026-04-22T19:00:25+07:00
- **Action needed**: Manual WhatsApp desktop read or decrypted extraction before importing this target into Sync ERP. Do not infer pricing from package defaults or adjacent records.

### Target 6: Cust SL - Fendy Banguntapan

- **chat_id**: 139358954885259@lid
- **phone**: 6282385609159
- **Status**: `needs_manual_review` (confidence: low)
- **Evidence source**: Chrome Profile 1 WhatsApp Web IndexedDB
  - Contact/name files: 000638.ldb, 000641.ldb, 000642.ldb, 000643.ldb
  - Message metadata files: 000638.ldb (1 hits), 000642.ldb (20 hits), 000643.ldb (30 hits)
  - Sample contact fragments: 000638.ldb: DFendy Banguntapan | o"parentMsgKey"/true_139358954885259@lid_3EB0CF3114C19010B83F3B"; 000641.ldb: 139358954885259@lid" | Cust SL - Fendy Banguntapan.; 000642.ldb: id".false_139358954885259@lid_3A028E2C746118D0874D" | id".false_139358954885259@lid_3A0D1688D82A7956DB61" | id".false_139358954885259@lid_3A2091C49887D6C87287"; 000643.ldb: id"-true_139358954885259@lid_2A0F38DBE38B1FDC401A" | id"-true_139358954885259@lid_2A1FBCBDE76252607982" | id"-true_139358954885259@lid_2A2FA5FCA6261F4461E8"
- **Invoice text**: NOT FOUND for this target - no readable target-specific invoice/order body text extractable via strings
- **Last chat**: 2026-03-29T11:23:21+07:00
- **Action needed**: Manual WhatsApp desktop read or decrypted extraction before importing this target into Sync ERP.

### Target 7: Cust SL - Imron Joglo Brongkol Godean

- **chat_id**: 145505053097988@lid
- **phone**: 6289696484565
- **Status**: `needs_manual_review` (confidence: low)
- **Evidence source**: Chrome Profile 1 WhatsApp Web IndexedDB
  - Contact/name files: 000638.ldb, 000641.ldb, 000642.ldb, 000643.ldb
  - Message metadata files: 000642.ldb (10 hits), 000643.ldb (10 hits)
  - Sample contact fragments: 000638.ldb: %YlImron Joglo Brongkol Godean; 000641.ldb: 145505053097988@lid" | 6289696484565@s.whatsapp.net" | name"%Cust SL - Imron Joglo Brongkol Godean"; 000642.ldb: id".false_145505053097988@lid_2AFEE436D7A5FAD7988C" | id":false_145505053097988@lid_AC2463EC2ADCCFC092A9495129ABFEA0" | id":false_145505053097988@lid_AC302038AC63ACD3C745CBCA88242753"; 000643.ldb: id"-true_145505053097988@lid_2A261EB9847C2611116E" | id"-true_145505053097988@lid_2A3CE5ABC107CC61BFE4" | id"-true_145505053097988@lid_2A573269B2D8D52C6593"
- **Invoice text**: NOT FOUND for this target - no readable target-specific invoice/order body text extractable via strings
- **Last chat**: 2026-04-11T17:31:51+07:00
- **Action needed**: Manual WhatsApp desktop read or decrypted extraction before importing this target into Sync ERP.

### Target 8: Cust SL - Alfrida Wirogunan

- **chat_id**: 166039308497106@lid
- **phone**: 6281230519177
- **Status**: `needs_manual_review` (confidence: low)
- **Evidence source**: Chrome Profile 1 WhatsApp Web IndexedDB
  - Contact/name files: 000638.ldb, 000639.ldb, 000641.ldb, 000642.ldb, 000643.ldb
  - Message metadata files: 000642.ldb (18 hits), 000643.ldb (17 hits)
  - Sample contact fragments: 000638.ldb: Cust SL - Alfrida Wirogunan; 000639.ldb: 166039308497106@lid.0"; 000641.ldb: 166039308497106@lid"; 000642.ldb: id".false_166039308497106@lid_3A02C246A3D2E1ACB8B7" | id".false_166039308497106@lid_3A168E064FEF6B425684" | id".false_166039308497106@lid_3A1FF618FD32DBFC7370"; 000643.ldb: id"-true_166039308497106@lid_2A073A458CFEA1BAAADC" | id"-true_166039308497106@lid_2A22E727EBAFD8DCFE7A" | id"-true_166039308497106@lid_2A37BDC367BAA90BB7B1"
- **Invoice text**: NOT FOUND for this target - no readable target-specific invoice/order body text extractable via strings
- **Last chat**: 2026-03-28T11:16:21+07:00
- **Action needed**: Manual WhatsApp desktop read or decrypted extraction before importing this target into Sync ERP.

### Target 9: Cust SL - Vivi Mergangsan

- **chat_id**: 173052889440465@lid
- **phone**: 6287838575705
- **Status**: `needs_manual_review` (confidence: low)
- **Evidence source**: Chrome Profile 1 WhatsApp Web IndexedDB
  - Contact/name files: 000638.ldb, 000641.ldb, 000642.ldb, 000643.ldb
  - Message metadata files: 000642.ldb (7 hits), 000643.ldb (10 hits)
  - Sample contact fragments: 000638.ldb: <Vivi Mergangsan; 000641.ldb: 8Vivi Mergangsan.$; 000642.ldb: id".false_173052889440465@lid_2AC1595749A790AE9589" | id":false_173052889440465@lid_AC1DB267D0835746EF804740F1F4CEE0" | id":false_173052889440465@lid_AC3614D614DDBB5DA08C91F2CCCDC07B"; 000643.ldb: id"-true_173052889440465@lid_2A098E2EBD93C7E77676" | 173052889440465@lid_73b9ac9fb_m" | id"-true_173052889440465@lid_2A22CA042BC5ABE2FC7A"
- **Invoice text**: NOT FOUND for this target - no readable target-specific invoice/order body text extractable via strings
- **Last chat**: 2026-02-19T20:03:15+07:00
- **Action needed**: Manual WhatsApp desktop read or decrypted extraction before importing this target into Sync ERP.

### Target 10: Cust SL - Agashi UNY

- **chat_id**: 184482367803447@lid
- **phone**: 6282338662649
- **Status**: `needs_manual_review` (confidence: low)
- **Evidence source**: Chrome Profile 1 WhatsApp Web IndexedDB
  - Contact/name files: 000638.ldb, 000641.ldb, 000643.ldb
  - Message metadata files: 000643.ldb (1 hits)
  - Sample contact fragments: 000638.ldb: (Agashi UNY; 000641.ldb: Yg$Agashi UNY.; 000643.ldb: id"-true_184482367803447@lid_2AB8E9283FF1DED75C61"
- **Invoice text**: NOT FOUND for this target - no readable target-specific invoice/order body text extractable via strings
- **Last chat**: 2026-02-01T12:28:49+07:00
- **Action needed**: Manual WhatsApp desktop read or decrypted extraction before importing this target into Sync ERP.

### Target 11: Cust SL - Lucky Tajem

- **chat_id**: 187445375189162@lid
- **phone**: 6281215110310
- **Status**: `needs_manual_review` (confidence: low)
- **Evidence source**: Chrome Profile 1 WhatsApp Web IndexedDB
  - Contact/name files: 000638.ldb, 000641.ldb, 000642.ldb, 000643.ldb
  - Message metadata files: 000642.ldb (8 hits), 000643.ldb (12 hits)
  - Sample contact fragments: 000638.ldb: index"*["contact","6281215110310@s.whatsapp.net"]" | Cust SL - Lucky Tajem | 187445375189162@lid ; 000641.ldb: Cust SL - Lucky Tajem. | (Lucky Tajem.g | 187445375189162@lid"; 000642.ldb: id".false_187445375189162@lid_3A101A99720A81D7A860" | id".false_187445375189162@lid_3A312C529D741429F32D" | id".false_187445375189162@lid_3A47336954B28BEF2664"; 000643.ldb: id"-true_187445375189162@lid_2A0414B1E40AA76E863F" | id"-true_187445375189162@lid_2A109FD8993A42DB716A" | id"-true_187445375189162@lid_2A271D9DCE4EAA46E6C0"
- **Invoice text**: NOT FOUND for this target - no readable target-specific invoice/order body text extractable via strings
- **Last chat**: 2026-03-18T15:01:17+07:00
- **Action needed**: Manual WhatsApp desktop read or decrypted extraction before importing this target into Sync ERP.

### Target 12: Cust SL d@π1€£ - Jakal KM9

- **chat_id**: 202443434537121@lid
- **phone**: 6281397301312
- **Status**: `needs_manual_review` (confidence: low)
- **Evidence source**: Chrome Profile 1 WhatsApp Web IndexedDB
  - Contact/name files: 000641.ldb, 000642.ldb, 000643.ldb
  - Message metadata files: 000642.ldb (7 hits), 000643.ldb (9 hits)
  - Sample contact fragments: 000641.ldb: 202443434537121@lid"; 000642.ldb: id".false_202443434537121@lid_2AC819B90FA5FF4D3E2A" | id":false_202443434537121@lid_AC2B8A590BE045B20776BB074081D08F" | id":false_202443434537121@lid_AC56A490BFD01F1AB8587C90EEEFFDB6"; 000643.ldb: id"-true_202443434537121@lid_2A1BC9FC9F2E2E42FFF5" | id"-true_202443434537121@lid_2A23771AE6DA57DEF23F" | id"-true_202443434537121@lid_2A413EAC66A8C85BF486"
- **Invoice text**: NOT FOUND for this target - no readable target-specific invoice/order body text extractable via strings
- **Last chat**: 2026-02-22T09:33:23+07:00
- **Action needed**: Manual WhatsApp desktop read or decrypted extraction before importing this target into Sync ERP.

### Target 13: Cust SL Harza Arbaha Wates KP

- **chat_id**: 211699072290961@lid
- **phone**: 6285799318717
- **Status**: `needs_manual_review` (confidence: low)
- **Evidence source**: Chrome Profile 1 WhatsApp Web IndexedDB
  - Contact/name files: 000638.ldb, 000641.ldb, 000642.ldb, 000643.ldb
  - Message metadata files: 000642.ldb (12 hits), 000643.ldb (14 hits)
  - Sample contact fragments: 000638.ldb: Cust SL Harza Arbaha Wates KP; 000641.ldb: 211699072290961@lid" | Cust SL Harza Arbaha Wates KP. | 211699072290961@lid"; 000642.ldb: id":false_211699072290961@lid_AC00FF7FB49946113502561FA43B2A0D" | id":false_211699072290961@lid_AC1C38BAC682C22CFFD01DF6D9784191" | id":false_211699072290961@lid_AC22C06FD1B66F859026AC320446360D"; 000643.ldb: id"-true_211699072290961@lid_2A1B83A1D262D35197CB" | id"-true_211699072290961@lid_2A2CF5FD3E6E5610AE02" | id"-true_211699072290961@lid_2A3FDF80069FE438FC11"
- **Invoice text**: NOT FOUND for this target - no readable target-specific invoice/order body text extractable via strings
- **Last chat**: 2026-02-16T10:11:46+07:00
- **Action needed**: Manual WhatsApp desktop read or decrypted extraction before importing this target into Sync ERP.

### Target 14: Cust SL - Abdul Aziz Godean

- **chat_id**: 2134800085238@lid
- **phone**: 6282227705849
- **Status**: `needs_manual_review` (confidence: low)
- **Evidence source**: Chrome Profile 1 WhatsApp Web IndexedDB
  - Contact/name files: 000638.ldb, 000641.ldb, 000642.ldb, 000643.ldb
  - Message metadata files: 000642.ldb (15 hits), 000643.ldb (23 hits)
  - Sample contact fragments: 000638.ldb: index"*["contact","6282227705849@s.whatsapp.net"]" | Cust SL - Abdul Aziz Godean | 2134800085238@lid ; 000641.ldb: Cust SL - Abdul Aziz Godean2 | Cust SL - Abdul Aziz Godean.; 000642.ldb: id"8false_2134800085238@lid_AC0570908E63CE4E89F643BC662C5865" | id"8false_2134800085238@lid_AC1B3FD010692BDF066C4C31ADB4AB61" | id"8false_2134800085238@lid_AC242A0A165EF602BCD4471265376235"; 000643.ldb: id"+true_2134800085238@lid_2A085BD92C1E99BE56EF" | id"+true_2134800085238@lid_2A30FF959431F82FAB3A" | id"+true_2134800085238@lid_2A3C8C29DF9BC6477685"
- **Invoice text**: NOT FOUND for this target - no readable target-specific invoice/order body text extractable via strings
- **Last chat**: 2026-03-22T20:08:48+07:00
- **Action needed**: Manual WhatsApp desktop read or decrypted extraction before importing this target into Sync ERP.

### Target 15: Cust SL - Baby Tamantirto

- **chat_id**: 235286965551238@lid
- **phone**: 6282136362874
- **Status**: `needs_manual_review` (confidence: low)
- **Evidence source**: Chrome Profile 1 WhatsApp Web IndexedDB
  - Contact/name files: 000638.ldb, 000639.ldb, 000641.ldb, 000642.ldb, 000643.ldb
  - Message metadata files: 000638.ldb (1 hits), 000639.ldb (1 hits), 000642.ldb (10 hits), 000643.ldb (9 hits)
  - Sample contact fragments: 000638.ldb: Cust SL - Baby Tamantirto | msgKey"Kfalse_status@broadcast_ACC1E226494F9FC8AD7A7A3E207E7E7E_235286965551238@lid"; 000639.ldb: "Kfalse_status@broadcast_AC1CF52E34EA046B0E03AE67B32186C9_235286965551238@lid"; 000641.ldb: Cust SL - Baby Tamantirto.; 000642.ldb: id".false_235286965551238@lid_2A5663B2910C31784ED0" | id":false_235286965551238@lid_AC25246DA6E215F040D0BBEED9A41D63" | id":false_235286965551238@lid_AC3424BFEEC590D7F2468D399F3F7F57"; 000643.ldb: id"-true_235286965551238@lid_2A14C87B8D4935A33CE1" | id"-true_235286965551238@lid_2A3B112990F227478F99" | id"-true_235286965551238@lid_2A591130E5B073347540"
- **Invoice text**: NOT FOUND for this target - no readable target-specific invoice/order body text extractable via strings
- **Last chat**: 2026-04-22T19:24:09+07:00
- **Action needed**: Manual WhatsApp desktop read or decrypted extraction before importing this target into Sync ERP.

### Target 16: Cust SL - Muji Jakal Km19

- **chat_id**: 239435937521900@lid
- **phone**: 6287834253458
- **Status**: `needs_manual_review` (confidence: low)
- **Evidence source**: Chrome Profile 1 WhatsApp Web IndexedDB
  - Contact/name files: 000638.ldb, 000641.ldb, 000642.ldb, 000643.ldb
  - Message metadata files: 000642.ldb (12 hits), 000643.ldb (20 hits)
  - Sample contact fragments: 000638.ldb: Cust SL - Muji Jakal Km19; 000641.ldb: Cust SL - Muji Jakal Km19. | Cust SL - Muji Jakal Km19.O; 000642.ldb: id".false_239435937521900@lid_2AE4C7762C6241D7A317" | id":false_239435937521900@lid_AC0E40AC80384AEBA0F922A2FD31905C" | id":false_239435937521900@lid_AC22493334EE47D764638969266718F2"; 000643.ldb: id"-true_239435937521900@lid_2A0B8B8241E9C27CA4B5" | id"-true_239435937521900@lid_2A139F1C06F4DEC80E1D" | id"-true_239435937521900@lid_2A2BA1902EB381BF2BC0"
- **Invoice text**: NOT FOUND for this target - no readable target-specific invoice/order body text extractable via strings
- **Last chat**: 2026-03-27T11:02:56+07:00
- **Action needed**: Manual WhatsApp desktop read or decrypted extraction before importing this target into Sync ERP.

### Target 17: Cust SL - Aries Concat

- **chat_id**: 247755909894234@lid
- **phone**: 6281215220235
- **Status**: `needs_manual_review` (confidence: low)
- **Evidence source**: Chrome Profile 1 WhatsApp Web IndexedDB
  - Contact/name files: 000641.ldb, 000642.ldb, 000644.ldb
  - Message metadata files: 000642.ldb (7 hits), 000644.ldb (12 hits)
  - Sample contact fragments: 000641.ldb: Cust SL - Aries Concat.q; 000642.ldb: id".false_247755909894234@lid_2A24F36D1988B4ACE981" | id":false_247755909894234@lid_A514AE399CE63120175F43D1713309BA" | id":false_247755909894234@lid_A52ECCAD8EC908A01D7154045E89ACA6"; 000644.ldb: id"-true_247755909894234@lid_2A27AB5B29F9297E0821" | id"-true_247755909894234@lid_2A2CC63892BDA0644051" | id"-true_247755909894234@lid_2A57035CC314F7FC420D"
- **Invoice text**: NOT FOUND for this target - no readable target-specific invoice/order body text extractable via strings
- **Last chat**: 2026-04-06T06:00:39+07:00
- **Action needed**: Manual WhatsApp desktop read or decrypted extraction before importing this target into Sync ERP.

### Target 18: Cust SL - Felis/ Ella Jitar Dukuh

- **chat_id**: 266648917377034@lid
- **phone**: 6285710320538
- **Status**: `needs_manual_review` (confidence: low)
- **Evidence source**: Chrome Profile 1 WhatsApp Web IndexedDB
  - Contact/name files: 000638.ldb, 000641.ldb, 000642.ldb, 000644.ldb
  - Message metadata files: 000638.ldb (1 hits), 000642.ldb (12 hits), 000644.ldb (15 hits)
  - Sample contact fragments: 000638.ldb: o"parentMsgKey"-true_266648917377034@lid_2AAE14C911783EAAC04F"; 000641.ldb: !Cust SL - Felis/ Ella Jitar Dukuh"] | !Cust SL - Felis/ Ella Jitar Dukuh"; 000642.ldb: id".false_266648917377034@lid_2A27AB4F51D6EB57E8D9" | id":false_266648917377034@lid_AC1200138016AF43555E9BDF8F17A054" | id":false_266648917377034@lid_AC33F1E04838524E826EE01A44A6A781"; 000644.ldb: id"-true_266648917377034@lid_2A09034D3D1C27D0CBE5" | id"-true_266648917377034@lid_2A1480CAC34BA5ECBFB8" | id"-true_266648917377034@lid_2A25C994ABD2C4DD94E7"
- **Invoice text**: NOT FOUND for this target - no readable target-specific invoice/order body text extractable via strings
- **Last chat**: 2026-03-23T17:06:39+07:00
- **Action needed**: Manual WhatsApp desktop read or decrypted extraction before importing this target into Sync ERP.

### Target 19: Cust SL - Nisrina Kotagede

- **chat_id**: 273821462470758@lid
- **phone**: 6285642610313
- **Status**: `found_partial` (confidence: medium)
- **Evidence source**: Chrome Profile 1 WhatsApp Web IndexedDB
  - Contact/name files: 000638.ldb, 000641.ldb, 000642.ldb, 000644.ldb
  - Message metadata files: 000642.ldb (10 hits), 000644.ldb (15 hits)
  - Sample contact fragments: 000638.ldb: Cust SL - Nisrina Kotagede; 000641.ldb: Cust SL - Nisrina Kotagede. | 273821462470758@lid"; 000642.ldb: id".false_273821462470758@lid_2A3C60C9109463B7B498" | id"0false_273821462470758@lid_3EB0A45408F1B19E0C2AD3" | id":false_273821462470758@lid_AC10768FDED01206578865F2976E2392"; 000644.ldb: id"-true_273821462470758@lid_2A057757298DC5BAFE89" | id"-true_273821462470758@lid_2A259C62C5F44A6EBE3D" | id"-true_273821462470758@lid_2A3C3DDC87D5232FF982"
  - Partial invoice fragment in `000638.ldb`: `sudah dp`, `INVOICE PEMESANAN`, `Nama : Nisrina`, `Tanggal Kirim : 19 Maret 2026 (siang)`, `Durasi ... 4 hari`, apparent `02 pcs x Rp59k x 4 hari = Rp472k`, apparent total `Rp518k`; fragment is truncated.
- **Invoice text**: PARTIAL - target-specific but incomplete/truncated, not safe for ERP import
- **Last chat**: 2026-03-25T10:02:11+07:00
- **Action needed**: Manual WhatsApp desktop read or decrypted extraction before importing this target into Sync ERP.

### Target 20: Cust SL Nawang - Klaci Godean Py

- **chat_id**: 27930323349566@lid
- **phone**: 6282324941015
- **Status**: `needs_manual_review` (confidence: low)
- **Evidence source**: Chrome Profile 1 WhatsApp Web IndexedDB
  - Contact/name files: 000638.ldb, 000639.ldb, 000641.ldb, 000642.ldb, 000643.ldb, 000644.ldb
  - Message metadata files: 000639.ldb (7 hits), 000642.ldb (12 hits), 000643.ldb (2 hits), 000644.ldb (12 hits)
  - Sample contact fragments: 000638.ldb:  Cust SL Nawang - Klaci Godean Py | Mba Nawang; 000639.ldb: "Jfalse_status@broadcast_AC5866CD01B01668027A0E862737D756_27930323349566@lid" | Nawang Py | Cstatus@broadcast_AC3F4A81FC4BE3A0EFDE4149C851C6BE_27930323349566@lid}; 000641.ldb: Mba Nawang.s | 6282324941015@s.whatsapp.net" | name" Cust SL Nawang - Klaci Godean Py"; 000642.ldb: id"-false_27930323349566@lid_2A8BA777CB5E51A1ED47" | id"9false_27930323349566@lid_AC19294DEFBF8D20687FFF4E01E37373" | id"9false_27930323349566@lid_AC37C0C0DA1E3230BBF781E7123AFBCA"; 000643.ldb: id"Jfalse_status@broadcast_AC3BE50D4F7D97FB981888F6397D6574_27930323349566@lidc | id"Jfalse_status@broadcast_AC8F04F5621019544F2CC29ACF226F06_27930323349566@lidc | 27930323349566@lid{; 000644.ldb: id",true_27930323349566@lid_2A074AE4AC5EC1AC34B9" | id",true_27930323349566@lid_2A2ED09811DEF7F4B508" | id",true_27930323349566@lid_2A4DC27E248F96E28FFE"
- **Invoice text**: NOT FOUND for this target - no readable target-specific invoice/order body text extractable via strings
- **Last chat**: 2026-04-13T15:37:50+07:00
- **Action needed**: Manual WhatsApp desktop read or decrypted extraction before importing this target into Sync ERP.

### Target 21: Cust SL - Jhon BT XT Square

- **chat_id**: 58553473724608@lid
- **phone**: 6281239888400
- **Status**: `needs_manual_review` (confidence: low)
- **Evidence source**: Chrome Profile 1 WhatsApp Web IndexedDB
  - Contact/name files: 000638.ldb, 000641.ldb, 000644.ldb
  - Message metadata files: 000644.ldb (1 hits)
  - Sample contact fragments: 000638.ldb: Cust SL - Jhon BT XT Square; 000641.ldb: 58553473724608@lid" | 6281239888400@c.us" | Cust SL - Jhon BT XT Square"; 000644.ldb: id",true_58553473724608@lid_2A89156606E5D058521F"
- **Invoice text**: NOT FOUND for this target - no readable target-specific invoice/order body text extractable via strings
- **Last chat**: 2026-03-30T14:27:14+07:00
- **Action needed**: Manual WhatsApp desktop read or decrypted extraction before importing this target into Sync ERP.

### Target 22: Cust SL - Harmawan KulProg

- **chat_id**: 61633401467054@lid
- **phone**: 6283197713255
- **Status**: `needs_manual_review` (confidence: low)
- **Evidence source**: Chrome Profile 1 WhatsApp Web IndexedDB
  - Contact/name files: 000638.ldb, 000641.ldb, 000642.ldb, 000644.ldb
  - Message metadata files: 000638.ldb (1 hits), 000642.ldb (8 hits), 000644.ldb (9 hits)
  - Sample contact fragments: 000638.ldb: Cust SL - Harmawan KulProg | msgKey"9false_61633401467054@lid_A593C73838966007732CE5DCBEE35698"; 000641.ldb: 61633401467054@lid: | 6283197713255@c.us" | Cust SL - Harmawan KulProg.; 000642.ldb: id"9false_61633401467054@lid_A50829C5977337792B3B5811E9AE954D" | id"9false_61633401467054@lid_A52A7DA682F93B69E36927BC81E2D190" | id"9false_61633401467054@lid_A54ED33ED78DB9CAAFA71D50490E6855"; 000644.ldb: id",true_61633401467054@lid_2A01CC2A5264DEA9D4B0" | id",true_61633401467054@lid_2A5D20D1A382888733FD" | id",true_61633401467054@lid_2A8506F30DAED1D95A17"
- **Invoice text**: NOT FOUND for this target - no readable target-specific invoice/order body text extractable via strings
- **Last chat**: 2026-04-12T12:15:02+07:00
- **Action needed**: Manual WhatsApp desktop read or decrypted extraction before importing this target into Sync ERP.

### Target 23: Cust SL - Asti Bantul

- **chat_id**: 68998750302360@lid
- **phone**: 6285163192520
- **Status**: `needs_manual_review` (confidence: low)
- **Evidence source**: Chrome Profile 1 WhatsApp Web IndexedDB
  - Contact/name files: 000638.ldb, 000641.ldb, 000642.ldb, 000644.ldb
  - Message metadata files: 000642.ldb (19 hits), 000644.ldb (23 hits)
  - Sample contact fragments: 000638.ldb: Cust SL - Asti Bantul; 000641.ldb: (Asti Bantul.:; 000642.ldb: id"-false_68998750302360@lid_3A02E6F7F99CFBB73FA2" | id"-false_68998750302360@lid_3A196B08C40CDEA1179C" | id"-false_68998750302360@lid_3A25BE49A8A5C6A65087"; 000644.ldb: id",true_68998750302360@lid_2A0F255E5666609DDE2E" | id",true_68998750302360@lid_2A3AE48170D33D9EF272" | id",true_68998750302360@lid_2A58B211A11D23ECE9E3"
- **Invoice text**: NOT FOUND for this target - no readable target-specific invoice/order body text extractable via strings
- **Last chat**: 2026-04-11T10:58:33+07:00
- **Action needed**: Manual WhatsApp desktop read or decrypted extraction before importing this target into Sync ERP.

### Target 24: Cust SL - Experian Kemusuk Bantul

- **chat_id**: 80573636808926@lid
- **phone**: 6289604406383
- **Status**: `needs_manual_review` (confidence: low)
- **Evidence source**: Chrome Profile 1 WhatsApp Web IndexedDB
  - Contact/name files: 000638.ldb, 000641.ldb, 000642.ldb, 000644.ldb
  - Message metadata files: 000638.ldb (1 hits), 000642.ldb (10 hits), 000644.ldb (16 hits)
  - Sample contact fragments: 000638.ldb: o"parentMsgKey"9false_80573636808926@lid_AC2C9E328CFB07B1750352C4BE12BC54" | index"*["contact","6289604406383@s.whatsapp.net"]" | !Cust SL - Experian Kemusuk Bantul; 000641.ldb: !Cust SL - Experian Kemusuk Bantul" | !Cust SL - Experian Kemusuk Bantul"*J; 000642.ldb: id"/false_80573636808926@lid_3EB00696AC90A0C6939F4C" | id"/false_80573636808926@lid_3EB020B3C6E5F32B4327C4" | id"/false_80573636808926@lid_3EB08C1123117169347552"; 000644.ldb: id",true_80573636808926@lid_2A113066120705C2BE2A" | id",true_80573636808926@lid_2A2D5DB90303B4E2533B" | id",true_80573636808926@lid_2A39413D2F8155208779"
- **Invoice text**: NOT FOUND for this target - no readable target-specific invoice/order body text extractable via strings
- **Last chat**: 2026-03-31T17:43:40+07:00
- **Action needed**: Manual WhatsApp desktop read or decrypted extraction before importing this target into Sync ERP.

### Target 25: Cust SL - Emma Wirogunan

- **chat_id**: 93565912920222@lid
- **phone**: 62895360123666
- **Status**: `needs_manual_review` (confidence: low)
- **Evidence source**: Chrome Profile 1 WhatsApp Web IndexedDB
  - Contact/name files: 000638.ldb, 000639.ldb, 000641.ldb, 000642.ldb, 000643.ldb, 000644.ldb
  - Message metadata files: 000638.ldb (6 hits), 000639.ldb (6 hits), 000642.ldb (11 hits), 000643.ldb (4 hits), 000644.ldb (14 hits)
  - Sample contact fragments: 000638.ldb: 62895360123666* | Cust SL - Emma Wirogunan | Cstatus@broadcast_AC9B77AFA56EB72F8FD1E7D7C97056F9_93565912920222@lid6; 000639.ldb: "Jfalse_status@broadcast_AC2EF2CB781AF8624F0EEA70D7ADBBCD_93565912920222@lid" | "Jfalse_status@broadcast_AC6B0F2EFA1D02DB353A464EF64A349D_93565912920222@lid" | msgKey"Jfalse_status@broadcast_ACDB931C4ED635EE29DA07636F071A71_93565912920222@lid"; 000641.ldb: Cust SL - Emma Wirogunan.Q | Cust SL - Emma Wirogunan.; 000642.ldb: id"-false_93565912920222@lid_2A2BCAB38E9360D36566" | id"9false_93565912920222@lid_AC134610232CE4047AE63E6090ED2C40" | id"9false_93565912920222@lid_AC3E18CCA893351F333A3E6ECC5B0B84"; 000643.ldb: id"Jfalse_status@broadcast_AC87685F010E042A7798816482074C8E_93565912920222@lid" | 93565912920222@lid{ | UNKNOWN"parentMsgKey"Kfalse_status@broadcast_AC2A5E241B673222B94DE739C48BE2D2_62895360123; 000644.ldb: id",true_93565912920222@lid_2A232B224AD523B6A154" | id",true_93565912920222@lid_2A3387EF21C2C6F42B03" | id",true_93565912920222@lid_2A49E094E856F5958B4A"
- **Invoice text**: NOT FOUND for this target - no readable target-specific invoice/order body text extractable via strings
- **Last chat**: 2026-04-14T13:40:12+07:00
- **Action needed**: Manual WhatsApp desktop read or decrypted extraction before importing this target into Sync ERP.
