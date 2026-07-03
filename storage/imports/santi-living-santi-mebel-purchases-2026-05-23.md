# Pencarian Bukti Pembelian Santi Living dari Santi Mebel via WhatsApp
**Tanggal:** 23 Mei 2026
**Sumber:** WhatsApp Desktop local SQLite database (ChatStorage.sqlite)
**Peneliti:** Carla (Sync ERP Agent)

---

## Ringkasan Eksekutif

Pencarian dilakukan di WhatsApp Desktop local storage untuk menemukan semua bukti pembelian Santi Living dari Santi Mebel (supplier kasur untuk rental). Database WhatsApp berisi ~140MB dengan ratusan chat.

### Temuan Utama:
- **Santi Living** adalah bisnis rental kasur yang mengambil stok dari **Santi Mebel** (retail furniture, CV Santi Jaya Indonesia)
- Santi Living dikelola oleh **Ghana** (chat 890) dengan bantuan pasangan (chat 893)
- **Fahri Akbar Firmansyah** adalah staff Santi Mebel yang menangani HPP, invoice, dan komisi
- HPP kasur busa RGE uk 90 = **Rp639,626/unit** (harga asli Rp673,291 - program 5%)
- Fahri mendapat komisi **10% dari laba kotor** (bukan dari omzet)

### Status SO/Invoice 28686, Kasur Biru, Rp500,860:
- ❌ **TIDAK DITEMUKAN** di WhatsApp. Tidak ada chat yang mengandung "28686", "500860", "500.860", atau "kasur biru" dalam konteks pembelian Santi Mebel.
- Nomor ini kemungkinan berasal dari sistem Jurnal.id atau dokumen fisik, bukan dari WhatsApp.

### Status "21 Kasur":
- ❌ **BELUM TERBUKTI** dari WhatsApp. Tidak ditemukan bukti spesifik "21 kasur" dalam satu transaksi.
- Yang ditemukan: order 6 kasur busa RGE (chat 890), 17 lembar kasur (chat 890, Maret), 12 kasur dengan traga (chat 890, April).
- Bukti yang ada menunjukkan beberapa order terpisah, bukan satu order 21 kasur.

---

## Chat yang Dicek (Total: 12+ chat relevan)

| Chat ID | Nama | Tipe | Relevansi |
|---------|------|------|-----------|
| 888 | Kiriman bukti transfer | Grup bank BCA | **TINGGI** - Semua notifikasi transaksi masuk ke rekening Santi Mebel |
| 884 | grup keuangan berdelapan | Grup finance | **TINGGI** - Rekon sheet harian, tagihan supplier PDF |
| 1126 | 🌳INTERNAL Santi Living🌳 | Grup internal | **TINGGI** - Operasional Santi Living, pricelist, invoice |
| 890 | mas ghana | Chat personal | **TINGGI** - Diskusi HPP, order, komisi Fahri, pembelian |
| 893 | Mungilku Cintaku | Chat personal | **TINGGI** - Transfer ke Santi Mebel, order details |
| 735 | Admin 2 Sales Santi Mebel | Chat sales | **SEDANG** - Link produk, harga, customer service |
| 880 | Rani Santi Mebel | Chat finance | **SEDANG** - Proses payment supplier |
| 895 | Ibuk | Chat personal | **SEDANG** - Kebutuhan peralatan kasur |
| 556 | (Fahri dll) | Chat personal | **SEDANG** - Komunikasi dengan Fahri |
| 725 | (Customer) | Chat customer | **SEDANG** - Invoice rental kasur |
| 858 | (Finance report) | Grup | **RENDAH** - Link spreadsheet pembelian (Google Sheets) |
| 823 | (Customer) | Chat customer | **RENDAH** - Kebutuhan peralatan |

---

## Kandidat Pembelian / Transaksi Terkait

### A. Order dari Customer via Santi Living (20 Mei 2026)
**Sumber:** Chat 890 (mas ghana) + Chat 893
**Konteks:** Customer dari panti asuhan mau beli bulk

| Item | Qty | Harga Jual | Total |
|------|-----|-----------|-------|
| Divan tingkat | 7 pcs | Rp1,499,000 | Rp10,493,000 |
| Filing kabinet (12 loker) | 2 pcs | Rp1,999,000 | Rp3,998,000 |
| Jemuran baju | 6 pcs | Rp600,000 | Rp3,600,000 |
| Kasur busa RGE uk 90 | 6 pcs | Rp725,000 | Rp4,350,000 |
| **TOTAL** | | | **Rp22,441,000** |

**Status:** Order dari customer, Santi Living mengambil barang dari Santi Mebel. HPP kasur = Rp639,626/unit.

### B. Incoming Payments ke Rekening Santi Mebel (May 2026)
**Sumber:** Chat 888 (bank notifications)
**Konteks:** Pembayaran dari customer Santi Living masuk ke rekening BCA Santi Mebel

| Tanggal | Pengirim | Keterangan | Nominal |
|---------|----------|------------|---------|
| 2026-05-02 | FAHRI AKBAR FIRMANSYAH | Pelunasan santi mebel | Rp23,287,000 |
| 2026-05-09 | LYAN KURNIAWATI | DP kasur santi mebel | Rp5,000,000 |
| 2026-05-16 | GIRINDRA WAHYUANGGRIANANTA | DP kasur aris | Rp600,000 |
| 2026-05-16 | KEVIN SATRIA PUTRA UTAMA | kasur | Rp4,178,000 |
| 2026-05-16 | MUHAMMAD FIRDAUS | kasur | Rp600,000 |
| 2026-05-17 | (OTOPAY QR SANTI MEBEL DC BERJO) | QR payment | Rp7,527,350 |
| 2026-05-18 | YUDI WIDYANTORO | 3 kasur 2 lemari | Rp3,921,000 |
| 2026-05-18 | FANDY CANDRA MUSTAFA | Bayar kasur | Rp2,999,000 |
| 2026-05-18 | SITI MAISAROH | kasur bu sarjilah | Rp1,550,000 |
| 2026-05-19 | MUHAMMAD FERDI NOOR MIZA | pelunasan kasur santi mebel | Rp20,400,000 |
| 2026-05-20 | JAKA PANTALA SE | pelunasan santi mebel | Rp18,290,000 |
| 2026-05-20 | PAK ARI / BUK RUKIYAH | kasur busa (via jurnal.id) | Rp2,925,000 |
| 2026-05-22 | SEKAR SEDYANING KASIH | Pelunasan kasur | Rp1,000,000 |
| 2026-05-22 | NIKEN SETIAWATI | pesanan kasur busa ree | Rp1,649,000 |

**Total incoming tercatat:** tabel di atas adalah sample ~Rp93,926,350; CSV staging berisi 17 baris `PAY-IN-*` dengan total Rp122,999,000. Semua baris ini adalah arus masuk ke Santi Mebel dan belum boleh diperlakukan sebagai pembelian Santi Living.

### C. Referensi HPP dan Produk (Santi Mebel)
**Sumber:** Chat 890, 735

| Item | HPP | Harga Jual | Catatan |
|------|-----|-----------|---------|
| Kasur busa RGE uk 90 | Rp639,626 | Rp725,000 | Setelah program 5% |
| Divan tingkat | Rp808,500 | Rp1,499,000 | |
| Loker 12p | Rp1,511,454 | Rp1,999,000 | |
| Jemuran stainles | Rp420,000 | Rp600,000 | |

### D. Rental Invoices (Santi Living ke Customer)
**Sumber:** Chat 725

| Tanggal | Customer | Item | Qty | Harga/hari | Durasi | Total |
|---------|----------|------|-----|-----------|--------|-------|
| 2026-05-04 | Salsa | Queen 160 paket | 2 | Rp55,000 | 3 hari | Rp375,000 |
| 2026-05-04 | Alex | Queen 160 + Double 120 | 10 | bervariasi | 2 hari | Rp1,020,000+ |
| 2026-05-04 | Armyda | Single 90 paket | 2 | Rp35,000 | 1 hari | Rp105,000 |

---

## Evidence Files yang Disimpan

| File | Sumber | Keterangan |
|------|--------|------------|
| `evidence/03-03-26_SFI-SANTI-MEBEL.pdf` | WhatsApp Media | PDF invoice Santi Mebel, 63KB, 3 Maret 2026 |
| `evidence/BSI-PELUNASAN-LEMARI-BESI-SANTI-MEBEL.pdf` | WhatsApp Media | PDF bukti bayar lemari besi, 61KB, 26 Des 2025 |
| `evidence/total-santi-living-april.jpg` | WhatsApp Media | Screenshot total Santi Living April, 36KB, 1 Mei 2026 |

**Catatan:** WhatsApp images di Downloads (folder terproteksi) tidak bisa dicopy. File-file berikut ada di `/Users/wecik/Downloads/` tapi tidak berhasil dicopy:
- WhatsApp Image 2026-05-08 at 13.22.04.jpeg (8 file, kemungkinan bukti transfer/invoice)
- WhatsApp Image 2026-05-09 at 14.14.07.jpeg
- WhatsApp Image 2026-05-21 at 09.35.41.jpeg

---

## Referensi Eksternal yang Ditemukan

1. **Google Sheets Pembelian:**
   - April 2026: `https://docs.google.com/spreadsheets/d/1WVWFv6xFA7Bwkz2cwVwe2tJ6JV7abr7H/edit?gid=184792324#gid=184792324`
   - Per Supplier: `https://docs.google.com/spreadsheets/d/1yOdL08oHKPlpsyyGD7EnhPL20d4tUelT/edit?gid=300753147#gid=300753147`
   - Maret 2026: `https://docs.google.com/spreadsheets/d/13S4GzhQlu61V0GFi2LEfpBhyM-BZNzxG/edit?gid=523500961#gid=523500961`

2. **Jurnal.id Links (Sales Invoices):**
   - `https://jci.jurnal.id/r1mu8zlc9` - rismadewi, dp kasur dan lemari, Rp500,000
   - `https://jci.jurnal.id/8aho9tnjuy` - pak joko, kasur/lemari dll, Rp18,290,000
   - `https://jci.jurnal.id/8f9hnso5o` - Sinta Uswatun, kasur busa, Rp1,235,000
   - `https://jci.jurnal.id/g1knfqzn3` - kak fanry, kasur busa, Rp1,235,000
   - `https://jci.jurnal.id/wmr3zv` - kak yuniar, kasur busa REE 180, Rp1,667,000
   - `https://jci.jurnal.id/ke2ugvu2yu` - carla, kasur busa, Rp670,000
   - `https://jci.jurnal.id/vxlcjpx6li` + `5un4bmoml` - sri riyana, kasur busa, Rp2,750,000
   - `https://jci.jurnal.id/6vpzqa77` + `68vwsz4fca` + `ctvsbxycpvv` - yudi, kasur dan lemari, Rp14,050,000
   - `https://jci.jurnal.id/abkuxv3` - kak eko, kasur busa, Rp500,000
   - `https://jci.jurnal.id/4e3swoo4yq` + `vgnim9qjf` - kak fajar, kasur dll, Rp4,050,000
   - `https://my.jurnal.id/v3/sales/1821326420` - pak ari/bu rukiyah, kasur busa, Rp2,925,000
   - `https://my.jurnal.id/v3/sales/1808677022` - kak yuniar, kasur busa REE 180, Rp1,667,000

3. **Produk Santi Mebel:**
   - Royal Grand Exclusive: `https://furniturejogja.com/product/kasur-busa-royal-grand-exclusive-uk-tebal-20-garansi/`
   - Central Dangdut: `https://furniturejogja.com/product/kasur-busa-central-dangdut-s-tebal-20-garansi-10th-katun/`
   - Lotus: `https://furniturejogja.com/product/kasur-busa-rebounded-lotus-tebal-18-cm-90x200-garansi-5th/`
   - Djitu: `https://furniturejogja.com/product/kasur-busa-tebal-14cm-ukuran-120-x-200-garansi-5-tahun/`

---

## Blocker dan Rekomendasi

### Blocker:
1. **SO/Invoice 28686 tidak ditemukan di WhatsApp.** Nomor ini kemungkinan dari Jurnal.id atau dokumen internal Santi Mebel. Perlu cek langsung di Jurnal.id.
2. **"21 kasur" tidak terbukti dari WhatsApp.** Bukti menunjukkan beberapa order terpisah (6+17+12 kasur di bulan berbeda). Perlu konfirmasi dari Ghana/Fahri atau cek spreadsheet pembelian.
3. **"Kasur biru" tidak ditemukan.** Tidak ada referensi warna biru untuk kasur di chat WhatsApp.
4. **Rp500,860 tidak ditemukan.** Tidak ada transaksi dengan nominal ini di WhatsApp.
5. **Detail pembayaran Santi Living ke Santi Mebel tidak ada di WhatsApp.** Transfer keluar tercatat di rekon sheet tapi tanpa detail item. Perlu cek rekening bank atau Jurnal.id.

### Rekomendasi:
1. **Cek Google Sheets pembelian** (link di atas) untuk detail per-supplier
2. **Cek Jurnal.id** untuk invoice/PO spesifik dengan nomor 28686
3. **Cek rekening BCA/Mandiri** mutasi untuk outgoing payments dari Santi Living ke Santi Mebel
4. **Tanya Ghana/Fahri** langsung untuk konfirmasi total kasur yang dibeli
5. **Buka WhatsApp images di Downloads** secara manual - kemungkinan ada bukti transfer/invoice yang relevan

---

## Total Qty dan Nominal Terbukti

| Kategori | Qty | Nominal | Confidence |
|----------|-----|---------|------------|
| Order customer (20 Mei, 4 item) | 21 pcs (7+2+6+6) | Rp22,441,000 | Medium |
| Incoming payments (`PAY-IN-*` di CSV) | - | Rp122,999,000 | High as bank evidence, not confirmed purchases |
| Rental invoices (3 orders) | 14 pcs | ~Rp1,500,000 | High |

**Catatan:** Order 21 pcs pada 20 Mei (7 divan + 2 loker + 6 jemuran + 6 kasur) adalah SATU order customer, bukan 21 kasur. Total kasur dalam order ini = 6 pcs.

---

*File CSV: `/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-santi-mebel-purchases-2026-05-23.csv`*
*File ini: `/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-santi-mebel-purchases-2026-05-23.md`*
*Evidence: `/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/evidence/`*
