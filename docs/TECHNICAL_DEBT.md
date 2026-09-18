# 📋 Technical Debt Register — Sync ERP

Dokumen ini mencatat daftar technical debt, kompromi arsitektural, dan fitur sementara yang didekomisi untuk diperbaiki di masa mendatang sesuai roadmap produk.

---

## 📌 TD-001: Decommissioning "Uji Coba Transaksi Pertama" dari Alur Onboarding Utama

* **Tanggal Dicatat**: 17 September 2026
* **Status**: `DECOMMISSIONED_FROM_FLOW` (Dilewati dari alur aktif, didokumentasikan untuk redisposisi)
* **Terdampak**: `apps/api/src/trpc/routers/onboarding.router.ts`, `apps/web/src/features/onboarding/pages/OnboardingPage.tsx`
* **Pemilik / Pelapor**: Khusnudhoni / Santi Living Onboarding Review

---

### 1. Deskripsi & Latar Belakang Masalah
Pada implementasi awal Onboarding Wizard Sync ERP, Langkah 03 dirancang sebagai **"Uji Coba Transaksi Pertama"** (`runFirstTransactionRetail`). Pada langkah ini, pengguna diwajibkan mengisi:
* Nama Supplier / Pemasok (contoh: *PT Sumber Rejeki*)
* Nama Barang / Aset (contoh: *Unit AC Portable*)
* Kuantitas & Harga Satuan
* Toggle Bayar Langsung (Lunas)

Di balik layar, sistem mengeksekusi *Purchase Order (PO) ➔ Goods Receipt Note (GRN) ➔ Faktur Pembelian (Bill) ➔ Pembayaran Kas/Bank*, lalu memposting 3 jurnal akuntansi sekaligus ke buku besar.

---

### 2. Akar Masalah & Dampak Negatif (Kenapa Terasa *Awkward*)
1. **Pencemaran Buku Besar Akuntansi (Accounting Data Pollution)**:
   Pengguna yang baru saja memasukkan saldo awal riil (modal kas & bank sebenarnya) dipaksa membuat transaksi pembelian fiktif. Akibatnya, buku besar, laporan laba rugi, neraca saldo, dan daftar hutang (AP) langsung terkontaminasi transaksi coba-coba yang sulit dibatalkan oleh pengguna awam.
2. **Ketidakcocokan Model Bisnis (Domain Mismatch)**:
   Untuk tipe bisnis non-retail, khususnya **Rental / Jasa Sewa** (*Santi Living*), aktivitas inti perusahaan adalah **menyewakan aset inventaris yang telah dimiliki** ke pelanggan. Memaksa alur pengadaan barang dari supplier asing saat pertama kali mendaftar tidak relevan dengan kebutuhan bisnis rental.
3. **Friksi Kognitif & UX yang Membingungkan**:
   Pengguna merasa canggung: *"Apakah ini data asli atau pura-pura? Jika pura-pura, kenapa masuk ke pembukuan resmi saya? Jika asli, saya tidak sedang belanja apapun hari ini."*
4. **Smoke-Test Terbungkus Onboarding**:
   Fitur ini sejatinya adalah *engineering integration test* untuk memverifikasi pipeline jurnal, namun salah tempat karena dijadikan *hard gate* bagi pengguna akhir.

---

### 3. Keputusan & Tindakan Saat Ini (Current Resolution)
1. **Bypass / Pangkas Langkah 03 dari Alur Utama**:
   * Onboarding kini menjadi **3 langkah ringkas & esensial**:
     * **Langkah 01**: Tipe Bisnis (Rental, Jasa, Retail, Manufaktur)
     * **Langkah 02**: Saldo Awal Kas & Bank (Multi-Akun dinamis)
     * **Langkah 03**: Selesai / Ringkasan Workspace ➔ Buka Dashboard
   * Begitu Saldo Awal disimpan, sistem langsung mengarahkan ke halaman perayaan aktivasi workspace (`ALIVE_MOMENT`) dan membuka Dashboard.
2. **Pembersihan Data Fiktif**:
   Seluruh record transaksi pengadaan fiktif yang sempat terbuat pada workspace Santi Living dibersihkan, menyisakan jurnal murni `ONBOARDING_OPENING_BALANCE`.

---

### 4. Rencana Solusi Permanen (Future Roadmap)
1. **Dashboard Quick-Start Checklist (Non-Blocking)**:
   Alih-alih mengunci layar onboarding, pasang widget checklist interaktif di Dashboard:
   - [ ] Daftarkan unit barang sewa pertama ke katalog
   - [ ] Buat pesanan rental pertama
   - [ ] Lengkapi profil kop surat & invoice bisnis
2. **Katalog Aset Sewa Awal (Master Data Only)**:
   Jika ingin ada input barang saat onboarding, gantikan dengan form pendaftaran aset sewa yang sudah dimiliki (misal nama unit, tarif sewa per hari, jumlah unit) **tanpa membuat jurnal transaksi pembelian/hutang**.
3. **Dedicated Isolated Sandbox**:
   Jika simulasi transaksi akuntansi dibutuhkan untuk edukasi, buatkan fitur *"Coba Transaksi Simulasi"* di lingkungan sandbox demo terisolasi, bukan di workspace produksi perusahaan.
