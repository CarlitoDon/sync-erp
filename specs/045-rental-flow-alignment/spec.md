# Feature Specification: Alur Operasional Rental Riil (Rental Flow Alignment)

**Feature Branch**: `045-rental-flow-alignment`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "aku mau app ini kita sesuaikan dengan flow hasil grilling session"

## Clarifications

### Session 2026-09-18
- Q: Bagaimana tingkat kedalaman integrasi pencatatan keuangan yang diharapkan untuk transaksi pembayaran sewa (DP, pelunasan 70% di lokasi, perpanjangan, dan denda cuci)? → A: Integrasi Jurnal Akuntansi Otomatis Penuh (Option A): Setiap penerimaan DP, pelunasan 70% di lokasi, perpanjangan sewa, dan denda cuci otomatis memicu jurnal debet Kas/Bank dan kredit akun Pendapatan/Uang Muka Sewa di modul Keuangan Sync ERP.
- Q: Apakah fitur pengantaran bertahap dalam satu pesanan (skema Multi-Delivery seperti kasus pesanan Arsa) ingin dimasukkan langsung ke dalam ruang lingkup spesifikasi ini atau dipisahkan ke rilis lanjutan? → A: Rilis Lanjutan Terpisah (Option B): Spesifikasi ini berfokus menyelaraskan alur operasional standar 1 pengantaran utama (sesuai SOP hasil grilling session), sedangkan skema multi-delivery dalam 1 pesanan dialokasikan sebagai spesifikasi lanjutan (Feature 046).

## Scope Boundaries & Non-Goals

- **In-Scope**:
  - Alur operasional rental standar 5-fase: Pembuatan DRAFT, Konfirmasi & Penguncian Unit via DP ~30%, Serah Terima di Lokasi dengan Pelunasan Sisa 70%, Perpanjangan (Full & Partial Extension) dengan Ongkir Ekstra Armada, dan Pengembalian (Return) dengan Tagihan Cuci/Kerusakan Langsung tanpa Deposit Semu.
  - Integrasi pencatatan buku besar akuntansi ganda (`JournalEntry`) otomatis untuk setiap transaksi penerimaan kas (DP, pelunasan 70%, extension, denda).
- **Out-of-Scope (Deferred to Feature 046)**:
  - Skema multi-delivery 1 pesanan (pemecahan jadwal dan trip pengantaran multi-tanggal untuk unit berbeda dalam satu nomor order yang sama). Jika customer meminta pengantaran di dua tanggal berbeda, operasional saat ini membuatkan 2 nomor pesanan sewa terpisah per tanggal pengantaran.
  - Integrasi payment gateway otomatis (Midtrans/Xendit) untuk admin UI (pembayaran tetap diverifikasi admin berdasarkan transfer bank, QRIS statis, atau uang tunai di lapangan).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pembuatan Draft Order & Penguncian Stok via DP (Priority: P1)

Admin menerima pesanan sewa melalui WhatsApp/telepon dan mencatat pesanan baru sebagai draf tanpa langsung mengunci nomor seri kasur fisik. Setelah customer mentransfer uang muka (DP ~30% fleksibel), Admin mengonfirmasi pesanan, memilih akun Kas/Bank penampung DP, sehingga nomor seri unit kasur fisik resmi dialokasikan (RESERVED) dan sistem otomatis memposting jurnal penerimaan uang muka ke buku besar.

**Why this priority**: Merupakan gerbang awal seluruh transaksi sewa. Menghindari pemborosan alokasi nomor seri untuk pesanan yang belum tentu jadi menyewa sebelum ada komitmen uang muka, sekaligus memastikan kas masuk dari DP langsung terbukukan di neraca kas.

**Independent Test**: Admin dapat membuat pesanan draf, stok fisik belum berkurang, lalu saat konfirmasi pesanan dengan input pembayaran DP, sistem mengalokasikan nomor seri kasur, status order menjadi CONFIRMED, dan jurnal otomatis terbentuk di akun Kas/Bank vs Uang Muka Sewa.

**Acceptance Scenarios**:

1. **Given** Admin berada di halaman Rental Orders, **When** Admin mengklik "+ Order Baru", memilih/menambah customer, memilih tanggal sewa, memilih paket kasur & qty, lalu klik "Buat Order", **Then** pesanan terbentuk dengan status `DRAFT` dan belum ada nomor seri unit fisik yang terikat.
2. **Given** pesanan berstatus `DRAFT`, **When** customer membayar DP dan Admin mengklik "Confirm Order" pada RentalActionsCard lalu memasukkan rincian pembayaran DP (nominal & akun kas/bank), **Then** status order berpindah ke `CONFIRMED`, unit kasur menjadi `RESERVED`, dan sistem memposting jurnal debet Kas/Bank dan kredit Uang Muka Sewa.
3. **Given** stok kasur siap sewa di gudang tidak mencukupi saat konfirmasi, **When** modal konfirmasi terbuka, **Then** sistem menampilkan peringatan kekurangan stok dengan opsi "Konversi Stok ke Unit Rental" atau "Konfirmasi Manual (Lewati cek stok)" disertai catatan alasan.

---

### User Story 2 - Serah Terima Unit di Lokasi & Pelunasan 70% (Priority: P1)

Armada/kurir mengantarkan kasur ke kamar/kos customer. Customer melunasi sisa tagihan sewa (70%) langsung di lokasi (Cash / QRIS / Transfer), kurir memeriksa KTP fisik dan mengambil foto serah terima. Admin di kantor memverifikasi laporan kurir, mencatat pelunasan sewa pada modal serah terima dengan memilih akun Kas/Bank penampung, dan me-release unit sehingga masa sewa resmi berjalan (ACTIVE), status pembayaran menjadi Lunas, dan jurnal pengakuan pendapatan sewa otomatis terposting.

**Why this priority**: Menghilangkan asumsi salah bahwa sewa butuh security deposit tunai yang ditahan di awal. Pelunasan sewa 100% terjadi saat serah terima, sehingga pencatatan pelunasan dan pengakuan pendapatan wajib menyatu dengan aksi serah terima.

**Independent Test**: Buka order `CONFIRMED`, klik "Release Units (Serah Terima)", upload foto serah terima, pilih akun kas/bank pelunasan 70%, lalu submit. Status order berpindah ke `ACTIVE`, unit berpindah ke `RENTED`, chip pembayaran pesanan menjadi `Lunas`, dan jurnal pendapatan sewa otomatis tercatat di modul Akuntansi.

**Acceptance Scenarios**:

1. **Given** pesanan berstatus `CONFIRMED`, **When** Admin mengklik "Release Units (Serah Terima)", mencatat pembayaran sisa 70% (metode Cash/Transfer/QRIS dan akun kas tujuan), dan mengunggah foto serah terima (atau centang lewati foto), **Then** status order berpindah ke `ACTIVE`, unit fisik menjadi `RENTED`, dan jurnal pelunasan otomatis terbit.
2. **Given** pesanan yang telah diserahterimakan dan sisa 70% telah dilunasi, **When** daftar pesanan atau detail pesanan dilihat, **Then** chip pembayaran menampilkan status `Lunas` (bukan "Belum Bayar").

---

### User Story 3 - Pengembalian Unit & Penyelesaian Kerusakan Tanpa Deposit (Priority: P1)

Saat masa sewa berakhir, armada menjemput kasur dan memeriksa kondisi fisik di tempat (kebersihan noda ompol/tumpahan, robekan kain, kelengkapan sprei/bantal). Jika barang bersih, kurir membawa kembali ke gudang dan Admin memproses pengembalian. Jika terdapat noda/rusak, biaya cuci atau denda kerusakan langsung ditagihkan kepada customer di tempat tanpa memotong deposit semu, dan pembayaran denda langsung dibukukan ke jurnal penerimaan kas/pendapatan denda.

**Why this priority**: Menyelaraskan siklus penutupan order rental kasur dengan realitas bisnis di mana tidak pernah ada pemotongan security deposit fiktif saat unit dikembalikan, serta menjamin uang denda cuci langsung tercatat di pembukuan kasir.

**Independent Test**: Buka order `ACTIVE`, klik "Return Units", catat waktu kembali dan kondisi fisik tiap unit. Jika ada noda/rusak, input biaya cuci dan akun penerimaan kas. Order berpindah ke `COMPLETED`, unit baik menjadi `AVAILABLE`, unit bernoda menjadi `MAINTENANCE`, dan jurnal kas masuk denda cuci terbit otomatis.

**Acceptance Scenarios**:

1. **Given** pesanan berstatus `ACTIVE` yang telah selesai, **When** Admin membuka modal "Return Units" dan memilih kondisi unit `GOOD`, **Then** order berpindah ke `COMPLETED` dan unit fisik otomatis kembali menjadi `AVAILABLE`.
2. **Given** kasur yang dijemput terkena noda ompol/kotoran, **When** Admin memproses return dengan status noda/rusak, **Then** unit kasur tersebut berpindah ke status `MAINTENANCE`, sistem menerbitkan tagihan biaya cuci langsung, mencatat jurnal kas masuk atas denda, dan order ditutup menjadi `COMPLETED`.

---

### User Story 4 - Fleksibilitas Perpanjangan: Full vs Partial Extension (Priority: P2)

Customer yang menyewa beberapa unit kasur dapat memilih untuk memperpanjang seluruh kasur (Full Extension) atau hanya memperpanjang sebagian kasur (Partial Extension). Pada perpanjangan sebagian, sistem memfasilitasi penambahan biaya armada ekstra (ongkir penjemputan tambahan) karena terjadi trip logistik terpisah, dan pembayaran perpanjangan otomatis dibukukan sebagai pendapatan sewa & ongkir tambahan.

**Why this priority**: Sering terjadi dalam penyewaan rombongan kos/tamu di mana kepulangan anggota rombongan tidak bersamaan, menyebabkan penjemputan bertahap dan membutuhkan pencatatan pendapatan ongkir armada ekstra.

**Independent Test**: Pada pesanan dengan 3 unit, buka menu extension, pilih "Partial Extension", centang 1 unit untuk diperpanjang, masukkan biaya sewa tambahan + biaya armada ekstra, dan pilih akun kas. Sistem memperpanjang jadwal 1 unit tersebut, mencatat jurnal pendapatan, sementara 2 unit lainnya tetap pada jadwal penjemputan awal.

**Acceptance Scenarios**:

1. **Given** pesanan `ACTIVE` dengan 3 kasur, **When** Admin memilih "Partial Extension", mencentang 1 unit kasur, menentukan tanggal baru, dan mengisi biaya logistik armada tambahan, **Then** unit yang dipilih mendapatkan perpanjangan masa sewa, tagihan penjemputan tambahan ditambahkan ke total order, dan jurnal pendapatan perpanjangan terbit.
2. **Given** pesanan `ACTIVE`, **When** customer memperpanjang semua unit (Full Extension) dan membayar di muka, **Then** tanggal `rentalEndDate` dan jatuh tempo pesanan diundur sesuai durasi tambahan dengan status order tetap `ACTIVE`.

---

### User Story 5 - Penanganan Overdue Menjadi Sewa Harian Otomatis (Priority: P3)

Jika saat jadwal penjemputan kamar kos customer terkunci atau customer meminta penundaan pengambilan kasur, sistem tidak memberlakukan denda penalti kaku yang merusak hubungan pelanggan, melainkan mengonversinya secara otomatis atau manual sebagai sewa harian tambahan lengkap dengan pencatatan piutang/pembayaran sewanya.

**Why this priority**: Memberikan kenyamanan operasional dan fleksibilitas penagihan yang ramah pelanggan sesuai SOP Santi Living tanpa mengacaukan pembukuan piutang harian.

**Independent Test**: Pada pesanan yang telah melewati jadwal jemput (overdue), Admin dapat dengan 1 klik membuatkan extension harian tambahan, mencatat piutang/kas masuknya, dan mengirimkan pesan konfirmasi tagihan harian ke WhatsApp customer.

**Acceptance Scenarios**:

1. **Given** pesanan melewati tanggal sewa awal dan armada tertunda mengambil, **When** Admin memilih aksi "Konversi Sewa Harian", **Then** sistem membuatkan record perpanjangan 1 hari tambahan dengan tarif harian proporsional, menerbitkan jurnal/invoice tagihan, dan menyiapkan template pesan WhatsApp siap kirim.

---

### Edge Cases

- **Pembatalan Pesanan Sebelum Kirim & Pengembalian DP**: Jika customer membatalkan pesanan saat status masih `DRAFT` atau `CONFIRMED`, Admin mengklik "Cancel Order", unit `RESERVED` dilepas kembali menjadi `AVAILABLE`, dan jika DP di-refund, sistem memposting jurnal pembalik (Debet Uang Muka Sewa, Kredit Kas/Bank).
- **Kekurangan Stok Saat Konfirmasi Cepat**: Jika stok fisik tidak mencukupi, sistem tidak memblokir total melainkan memberikan jalur pintas pembuatan serial unit baru atau konfirmasi manual dengan alasan terdokumentasi.
- **Customer Melunasi Sebagian di Lokasi**: Jika kurir melaporkan customer baru membayar sebagian dari 70% sisa sewa, sistem mencatat sisa piutang aktual (Debet Kas/Bank sebagian + Debet Piutang Usaha sisa, Kredit Pendapatan Sewa) tanpa menggantung status serah terima unit.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Sistem MUST memungkinkan pembuatan pesanan rental baru berstatus `DRAFT` tanpa mewajibkan pengikatan nomor seri unit fisik.
- **FR-002**: Sistem MUST mendukung pencatatan pembayaran uang muka (Down Payment/DP) fleksibel pada saat pesanan berstatus `DRAFT`.
- **FR-003**: Sistem MUST mengalokasikan nomor seri unit kasur fisik dan mengubah status unit menjadi `RESERVED` saat pesanan dikonfirmasi (`CONFIRMED`).
- **FR-004**: Sistem MUST menyediakan fallback konfirmasi manual jika stok unit fisik rental kurang, meliputi opsi konversi stok barang dagang atau konfirmasi dengan catatan alasan.
- **FR-005**: Modal serah terima unit (`Release Units`) MUST menyediakan opsi pencatatan pelunasan pembayaran sisa sewa (70%) dengan metode Cash, Bank Transfer, atau QRIS.
- **FR-006**: Sistem MUST mengubah status pesanan menjadi `ACTIVE` dan status unit menjadi `RENTED` setelah proses serah terima diselesaikan.
- **FR-007**: Status pembayaran pesanan MUST secara otomatis menampilkan label `Lunas` jika seluruh biaya sewa dan ongkir telah terbayar lunas saat diserahterimakan.
- **FR-008**: Sistem MUST menyediakan pilihan perpanjangan sewa: `Full Extension` (semua unit) dan `Partial Extension` (sebagian unit terpilih).
- **FR-009**: Pada skenario `Partial Extension`, sistem MUST menyediakan input biaya logistik/ongkir ekstra armada untuk meng-cover trip penjemputan terpisah.
- **FR-010**: Sistem MUST memungkinkan pencatatan perpanjangan sewa harian untuk pesanan yang mengalami penundaan penjemputan (overdue).
- **FR-011**: Modal pengembalian unit (`Return Units`) MUST memungkinkan pencatatan kondisi fisik masing-masing unit tanpa mensyaratkan pemotongan uang deposit tunai.
- **FR-012**: Sistem MUST secara otomatis mengubah unit berkondisi baik menjadi `AVAILABLE` dan unit yang kotor/rusak menjadi `MAINTENANCE` saat pengembalian diproses.
- **FR-013**: Sistem MUST menerbitkan tagihan denda atau biaya cuci langsung kepada customer jika ditemukan kerusakan/noda saat pengembalian kasur.
- **FR-014**: Sistem MUST menutup pesanan menjadi `COMPLETED` setelah seluruh unit fisik yang disewa telah dikembalikan dan diproses.
- **FR-015**: Sistem MUST menyediakan pembatalan pesanan (`Cancel Order`) yang otomatis melepas unit `RESERVED` kembali menjadi `AVAILABLE`.
- **FR-016**: Sistem MUST secara otomatis memposting jurnal akuntansi ganda untuk setiap pembayaran DP yang diterima (Debet akun Kas/Bank yang dipilih, Kredit akun Uang Muka Sewa).
- **FR-017**: Sistem MUST memposting jurnal akuntansi saat pelunasan 70% diserahterimakan (Debet Kas/Bank, Kredit Pendapatan Sewa dan Pendapatan Ongkir, serta reklasifikasi Uang Muka Sewa menjadi Pendapatan Sewa).
- **FR-018**: Sistem MUST memposting jurnal penerimaan kas/bank saat biaya denda cuci atau kerusakan ditagihkan dan diterima di tempat (Debet Kas/Bank, Kredit Pendapatan Denda/Kerusakan Lain-lain).
- **FR-019**: Sistem MUST memposting jurnal perpanjangan sewa dan pendapatan ongkir tambahan pada skenario `Partial Extension` atau `Full Extension`.
- **FR-020**: Pada pembatalan order dengan refund DP, sistem MUST memposting jurnal pengembalian kas (Debet Uang Muka Sewa, Kredit Kas/Bank).

### BusinessShape Integration

- Fitur ini merupakan fitur inti operasional untuk entitas bisnis dengan shape **RENTAL** maupun **HYBRID** (Trading + Rental).
- Menu navigasi `Rental Management` tetap adaptif dan konsisten dengan Apple-like Design Guidelines yang diterapkan pada arsitektur Sync ERP.
- Modul Akuntansi & Kas/Bank terintegrasi secara transparan di balik layar tanpa membebani admin rental dengan input jurnal manual yang rumit.

### Key Entities

- **RentalOrder**: Entitas utama transaksi sewa dengan status lifecycle (`DRAFT`, `CONFIRMED`, `ACTIVE`, `COMPLETED`, `CANCELLED`).
- **RentalOrderItem**: Rincian item produk/bundle rental beserta kuantitas, durasi, tarif sewa harian/mingguan/bulanan, dan diskon.
- **RentalUnit**: Entitas aset kasur fisik bernomor seri dengan status ketersediaan (`AVAILABLE`, `RESERVED`, `RENTED`, `MAINTENANCE`, `RETIRED`).
- **RentalExtension**: Entitas pencatatan perpanjangan sewa berisi unit terkait, durasi tambahan, biaya sewa tambahan, dan biaya ekstra armada.
- **PaymentRecord**: Catatan transaksi pembayaran (DP ~30%, pelunasan 70%, pembayaran perpanjangan, atau denda cuci langsung) yang menyimpan referensi metode bayar, akun Kas/Bank, dan nominal.
- **JournalEntry & JournalLine**: Entitas buku besar akuntansi ganda yang otomatis diposting oleh sistem saat transaksi pembayaran sewa dan denda divalidasi.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admin dapat membuat draf pesanan sewa baru dalam waktu kurang dari 60 detik melalui modal pembuat pesanan.
- **SC-002**: 100% pesanan yang selesai dikembalikan (`COMPLETED`) dengan pelunasan penuh menampilkan indikator status `Lunas` tanpa membingungkan pengguna dengan label "Belum Bayar".
- **SC-003**: Admin dapat melakukan serah terima unit dan pencatatan pelunasan 70% dalam satu alur modal terpadu tanpa berpindah menu.
- **SC-004**: Sistem berhasil mengisolasi unit kasur bernoda ke status `MAINTENANCE` sehingga 0% unit kotor teralokasikan secara tidak sengaja ke pesanan baru.
- **SC-005**: 100% perpanjangan sebagian unit (`Partial Extension`) secara akurat mencatat biaya ekstra logistik armada dan memperbarui jadwal kembali unit secara individual.
- **SC-006**: 100% transaksi pembayaran rental (DP, pelunasan di tempat, extension, denda cuci) otomatis terbit jurnal buku besarnya dengan kondisi seimbang (balance debet = kredit) tanpa intervensi manual dari staf akuntansi.

---

## Assumptions

- Transaksi sewa kasur operasional Santi Living tidak menerapkan penahanan uang deposit tunai di muka dari pelanggan.
- Uang muka (DP) umumnya berada di kisaran ~30%, namun sistem menerima nominal DP yang fleksibel sesuai kesepakatan WhatsApp.
- Akun penampung standar (Kas Tunai, Rekening Bank BCA/Mandiri, Uang Muka Sewa, Pendapatan Sewa, Pendapatan Ongkir, Pendapatan Denda) sudah terdaftar di Chart of Accounts (COA) perusahaan.
- Inspeksi fisik kasur dilakukan langsung oleh pengemudi armada di lokasi pelanggan saat penjemputan.
- Kebutuhan pengantaran multi-tanggal (multi-delivery 1 pesanan) akan ditangani pada rilis spesifikasi Feature 046; untuk sementara pesanan dengan tanggal kirim berbeda dibuat sebagai 2 pesanan rental terpisah.
