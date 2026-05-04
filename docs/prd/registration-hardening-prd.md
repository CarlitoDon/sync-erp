# PRD: Registration Hardening & Account Activation

**Produk**: Sync ERP  
**Area**: Authentication, Onboarding, Security Hardening  
**Status**: Draft untuk scoping eksekusi  
**Tanggal**: 2026-05-04  
**Owner**: Product + Engineering

## 1. Latar Belakang

Flow registrasi Sync ERP awalnya berorientasi MVP:

- user bisa daftar dengan nama, email, dan password,
- akun langsung dianggap aktif,
- belum ada verifikasi email,
- proteksi abuse pada endpoint publik masih minimal,
- onboarding pasca-daftar belum cukup kuat untuk konteks production.

Untuk membawa sistem ke level yang lebih siap produksi, registrasi harus menjadi flow yang:

- aman terhadap abuse dasar,
- konsisten secara state antara frontend dan backend,
- memverifikasi kepemilikan email,
- terhubung rapi ke onboarding company,
- punya operasional deployment yang jelas.

## 2. Problem Statement

Tanpa hardening tambahan, flow registrasi berisiko menimbulkan masalah berikut:

- akun palsu atau typo email tetap masuk ke sistem,
- endpoint publik lebih mudah disalahgunakan untuk brute force atau spam,
- login membocorkan sebagian informasi kredensial,
- alur pasca-daftar terasa tidak matang untuk first-time user,
- deployment production berisiko tidak konsisten karena dependensi email belum terdokumentasi jelas.

## 3. Tujuan Produk

### Tujuan Utama

- Membuat flow registrasi Sync ERP layak untuk environment production awal.
- Menjamin hanya email yang diverifikasi yang bisa mengakses sistem.
- Menyelaraskan registrasi dengan onboarding company sebagai langkah pertama setelah aktivasi akun.

### Tujuan Pendukung

- Mengurangi risiko abuse pada endpoint auth publik.
- Mengurangi kebocoran informasi pada error login.
- Menyediakan fondasi operasional untuk pengiriman email verification.

## 4. Non-Goals

Hal-hal berikut **bukan target** PRD ini:

- password reset / forgot password,
- MFA / two-factor authentication,
- social login (Google, Microsoft, dsb),
- fraud detection lanjutan,
- bot defense tingkat lanjut seperti device fingerprinting,
- approval / admin moderation akun baru,
- identity verification di luar verifikasi email,
- full marketing onboarding redesign lintas seluruh landing flow.

## 5. Persona Utama

### Persona 1: Business Owner Baru

Pengguna baru yang ingin mencoba atau mulai memakai Sync ERP, tetapi belum punya company context.

### Persona 2: Tim Internal / Admin Produk

Pihak yang perlu memastikan akun baru yang masuk benar, bisa diaktivasi dengan aman, dan tidak memicu beban support berlebih.

## 6. User Journey Target

### Journey A: Registrasi Baru

1. Visitor membuka halaman daftar.
2. Visitor mengisi nama, email, password, dan konfirmasi password.
3. Sistem memvalidasi input dan membuat akun dalam status menunggu verifikasi.
4. Sistem mengirim email verifikasi.
5. UI mengarahkan user ke layar “cek email Anda”.
6. User klik link verifikasi.
7. Sistem memverifikasi token, membuat session, lalu mengarahkan user ke pemilihan company.

### Journey B: Login Sebelum Email Terverifikasi

1. User mencoba login dengan email dan password yang benar.
2. Sistem menolak login karena email belum diverifikasi.
3. UI menampilkan pesan verifikasi email dan menyediakan aksi resend verification.

### Journey C: Resend Verification

1. User belum menerima email atau link sudah expired.
2. User meminta resend verification.
3. Sistem menerbitkan token baru dan mengirim ulang email verifikasi.
4. Token lama tidak lagi dipakai.

## 7. Scope Pekerjaan

## 7.1 Sudah Selesai

- Sinkronisasi auth state frontend agar login/register tidak bergantung penuh pada refetch lambat.
- Validasi form registrasi yang lebih kuat:
  - confirm password,
  - normalisasi nama,
  - password minimal 8 karakter dengan huruf dan angka.
- Redirect pasca-auth ke flow onboarding company yang benar.
- Generic login error untuk mengurangi account enumeration.
- Rate limiting dasar pada endpoint auth publik.
- Email verification data model:
  - `User.emailVerifiedAt`,
  - `EmailVerificationToken`.
- Endpoint backend untuk:
  - `register`,
  - `verifyEmail`,
  - `resendVerification`.
- Halaman frontend untuk:
  - post-registration verify notice,
  - resend verification,
  - public verify-email landing page.
- Mailer service dengan provider:
  - `log` fallback,
  - `resend` untuk production-ready integration.
- Contoh env untuk URL web dan provider email.

## 7.2 In Scope Lanjutan

### A. Database & Deployment Readiness

- Membuat migration Prisma resmi untuk perubahan schema verifikasi email.
- Menentukan urutan rollout aman untuk environment staging dan production.
- Memastikan seed/dev workflow tetap kompatibel dengan field baru.

### B. Email Delivery Operations

- Finalisasi penggunaan provider email production (`resend` sebagai default rekomendasi).
- Validasi `from address`, domain, dan secret environment.
- Menentukan fallback behavior jika provider email gagal sementara.

### C. UX Hardening

- Cooldown visual untuk tombol resend verification.
- Copywriting yang lebih konsisten di register, login, dan verify page.
- Handling yang lebih baik untuk token expired vs invalid.

### D. Observability & Auditability

- Menambahkan log terstruktur untuk event:
  - registration created,
  - verification email sent,
  - verification completed,
  - resend requested,
  - email delivery failed.
- Menentukan apakah auth events perlu masuk audit trail formal.

### E. QA & Release Confidence

- Menambah coverage test backend untuk:
  - login blocked sebelum verification,
  - verify token valid/expired,
  - resend invalidation flow.
- Menambah smoke test manual / quickstart release.

## 7.3 Out of Scope Saat Ini

- forgot password,
- MFA,
- CAPTCHA/Turnstile,
- risk engine anti-fraud,
- admin approval akun,
- SSO,
- invitation-only registration,
- compliance email template management.

## 8. Functional Requirements

- **FR-001**: Sistem harus menerima registrasi publik dengan nama, email, password, dan konfirmasi password.
- **FR-002**: Sistem harus menormalisasi email dan nama sebelum disimpan.
- **FR-003**: Sistem harus menolak login untuk akun yang belum memiliki `emailVerifiedAt`.
- **FR-004**: Sistem harus membuat token verifikasi email yang sekali pakai dan punya masa berlaku.
- **FR-005**: Sistem harus menghapus / menggantikan token lama ketika resend verification dilakukan.
- **FR-006**: Sistem harus membuat session hanya setelah login valid atau verifikasi email sukses.
- **FR-007**: Sistem harus menyediakan endpoint resend verification yang aman terhadap abuse dasar.
- **FR-008**: Sistem harus menampilkan pengalaman frontend yang jelas setelah registrasi berhasil.
- **FR-009**: Sistem harus menyediakan halaman publik untuk memproses token verifikasi email.
- **FR-010**: Sistem harus menggunakan generic error untuk login failure agar tidak membocorkan apakah email terdaftar.
- **FR-011**: Sistem harus menerapkan rate limit dasar pada endpoint auth publik.
- **FR-012**: Sistem harus mendukung provider email production dan fallback aman di non-production.

## 9. Non-Functional Requirements

- **NFR-001**: Flow registrasi tetap bisa dipakai di development walaupun provider email production belum diaktifkan.
- **NFR-002**: Tidak boleh ada token verifikasi mentah yang disimpan di database.
- **NFR-003**: Endpoint auth publik harus memiliki guardrail terhadap spam atau brute force dasar.
- **NFR-004**: Perubahan tidak boleh merusak onboarding company yang sudah ada.
- **NFR-005**: Rollout harus aman untuk environment yang sudah memiliki user existing.

## 10. Key Entities

- **User**: akun pengguna, kini mencakup status verifikasi email.
- **Session**: sesi login aktif setelah auth valid.
- **EmailVerificationToken**: token hashed untuk aktivasi akun.
- **EmailDeliveryConfig**: konfigurasi provider email melalui environment.

## 11. Success Metrics

- Minimal 95% registrasi valid berhasil sampai tahap “verification link issued”.
- 100% login untuk akun belum terverifikasi ditolak dengan pesan yang sesuai.
- 0 token verifikasi mentah disimpan di database.
- 100% endpoint auth publik utama memiliki rate limiting dasar.
- Waktu aktivasi akun dari klik link verifikasi sampai masuk onboarding company kurang dari 10 detik pada kondisi normal.

## 12. Risiko Utama

### Risiko Teknis

- Migration database belum diterapkan ke environment aktif.
- Provider email production belum dikonfigurasi dengan benar.
- Existing user lama mungkin perlu strategi transisi untuk `emailVerifiedAt`.

### Risiko Produk

- Jika copywriting tidak cukup jelas, user bisa bingung mengapa tidak langsung bisa login.
- Jika resend terlalu longgar, endpoint dapat disalahgunakan untuk spam.

## 13. Asumsi

- Registrasi tetap bersifat publik, bukan invitation-only.
- Verifikasi email adalah syarat aktivasi akun.
- Company selection tetap menjadi langkah pertama setelah akun aktif.
- Provider email eksternal boleh digunakan untuk transactional email.
- Tidak ada existing user production yang perlu dimigrasikan karena aplikasi belum release.

## 14. Open Questions

- Apakah resend verification perlu cooldown yang terlihat jelas di UI, misalnya 30–60 detik?

## 15. Keputusan Produk yang Sudah Ditetapkan

- Tidak ada existing user yang perlu diperlakukan sebagai kasus transisi karena aplikasi belum release.
- Kegagalan pengiriman email verifikasi pada production adalah `hard fail`; registrasi tidak boleh dianggap berhasil bila email verifikasi gagal dikirim.
- Auth events harus masuk ke audit log formal, bukan hanya structured logs.

## 16. Implikasi Desain dari Keputusan

- Flow register harus dibungkus transaksi atau kompensasi yang jelas bila pembuatan akun berhasil tetapi pengiriman email gagal.
- Implementasi email provider production tidak boleh hanya fallback ke log pada environment production.
- Audit log harus mencakup minimal event berikut:
  - registration_created
  - verification_email_sent
  - verification_email_failed
  - verification_completed
  - verification_resend_requested
- Karena tidak ada existing user, migration schema auth dapat diperlakukan sebagai baseline release, bukan migrasi kompatibilitas mundur.

## 17. Rencana Delivery yang Disarankan

### Phase 1 — Foundation Stabilization

- Finalisasi PRD ini.
- Buat migration Prisma resmi.
- Terapkan behavior hard fail untuk email delivery production.
- Definisikan audit log auth events.

### Phase 2 — Production Readiness

- Aktifkan provider email production.
- Lengkapi env staging/production.
- Tambah audit log dan smoke test release.

### Phase 3 — UX & Operability

- Cooldown resend.
- Penajaman pesan UI.
- Monitoring auth events.

## 18. Definition of Done

Pekerjaan dianggap selesai bila:

- PRD disetujui sebagai baseline scope,
- migration Prisma tersedia dan tervalidasi,
- verifikasi email berjalan end-to-end di staging,
- kegagalan kirim email di production memblokir registrasi sesuai policy,
- auth events masuk ke audit log formal,
- env production email terdokumentasi dan tervalidasi,
- test dan build lintas web/api lulus,
- tidak ada open issue terkait transisi existing user karena aplikasi belum release.
