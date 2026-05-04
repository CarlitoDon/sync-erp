# Spec 044: Registration Hardening & Account Activation

## Ringkasan

Spesifikasi ini menurunkan PRD `registration-hardening-prd.md` menjadi requirement teknis yang bisa dieksekusi untuk membawa flow registrasi Sync ERP ke baseline production-ready.

Target utama:

- registrasi tidak langsung mengaktifkan akun,
- verifikasi email menjadi syarat login,
- pengiriman email verifikasi wajib sukses di production,
- auth events masuk ke audit log formal,
- flow frontend selaras dengan onboarding company.

## Keputusan Produk Final

- Tidak ada existing user karena aplikasi belum release.
- Kegagalan pengiriman email verification di production adalah `hard fail`.
- Auth events wajib masuk ke audit log formal.

## Scope Teknis

### Backend Auth

- Registrasi membuat user baru dalam status belum terverifikasi.
- Sistem menghasilkan token verifikasi email yang di-hash sebelum disimpan.
- Login ditolak bila `emailVerifiedAt` masih kosong.
- Resend verification menerbitkan token baru tanpa membiarkan token lama tetap aktif setelah pengiriman sukses.
- Verifikasi email yang sukses membuat session login dan mengarahkan user ke onboarding company.

### Email Delivery

- Non-production boleh memakai provider `log`.
- Production tidak boleh memakai fallback `log`.
- Bila provider email gagal di production, registrasi dianggap gagal.
- Register harus melakukan kompensasi agar akun tidak tertinggal bila email gagal terkirim.

### Auditability

- Sistem menyimpan auth audit log formal terpisah dari audit log bisnis berbasis `companyId`.
- Event minimum yang harus tercatat:
  - `REGISTERED`
  - `VERIFICATION_EMAIL_SENT`
  - `VERIFICATION_EMAIL_FAILED`
  - `VERIFICATION_RESEND_REQUESTED`
  - `EMAIL_VERIFIED`
  - `LOGIN_BLOCKED_UNVERIFIED`

### Frontend

- Halaman register menampilkan state `check your email` setelah sukses.
- Halaman login menampilkan opsi resend verification bila akun belum diverifikasi.
- Halaman publik `/verify-email` memproses token aktivasi.

## Data Model

### User

- Tambah `emailVerifiedAt: DateTime?`

### EmailVerificationToken

- Menyimpan token verifikasi email yang di-hash
- Relasi ke `User`
- Memiliki `expiresAt`, `consumedAt`, dan `createdAt`

### AuthAuditLog

- Menyimpan event audit formal untuk domain auth
- Tidak bergantung pada `companyId`
- Menyimpan:
  - `userId?`
  - `email`
  - `action`
  - `correlationId?`
  - `ipAddress?`
  - `userAgent?`
  - `metadata?`
  - `createdAt`

## Perilaku Sistem

### Register

1. Validasi input.
2. Cek email duplikat.
3. Simpan user baru.
4. Catat audit `REGISTERED`.
5. Buat token verifikasi.
6. Kirim email verifikasi.
7. Jika pengiriman email gagal:
   - catat audit `VERIFICATION_EMAIL_FAILED`,
   - hapus token baru,
   - hapus user yang baru dibuat,
   - kembalikan error register gagal.
8. Jika sukses:
   - hapus token lama lain untuk user tersebut,
   - catat audit `VERIFICATION_EMAIL_SENT`,
   - tampilkan verify notice di UI.

### Login

1. Validasi email/password.
2. Jika user belum verifikasi email:
   - tolak login,
   - catat audit `LOGIN_BLOCKED_UNVERIFIED`.

### Resend Verification

1. Catat audit `VERIFICATION_RESEND_REQUESTED`.
2. Buat token baru.
3. Kirim email verifikasi.
4. Jika sukses, hapus token aktif lama lain.
5. Jika gagal, pertahankan token lama yang masih valid.

### Verify Email

1. Cari token aktif yang valid.
2. Tandai user sebagai verified bila belum.
3. Tandai token sebagai consumed.
4. Hapus token aktif lain milik user.
5. Catat audit `EMAIL_VERIFIED`.
6. Buat session login.

## Error Handling

- Error email delivery untuk register/resend harus menjadi error eksplisit.
- Error login tetap generik untuk invalid credentials.
- Error token verifikasi invalid/expired harus user-facing dan actionable.

## Security Requirements

- Token verifikasi tidak boleh disimpan mentah di database.
- Endpoint auth publik tetap memakai rate limiting.
- Production tidak boleh diam-diam fallback ke provider `log`.

## Operasional

- Env minimum production:
  - `SYNC_ERP_WEB_URL`
  - `SYNC_ERP_EMAIL_PROVIDER=resend`
  - `SYNC_ERP_EMAIL_FROM`
  - `RESEND_API_KEY`
- Migration Prisma harus tersedia sebelum release pertama.

## Verifikasi

Spesifikasi dianggap terpenuhi bila:

- migration tersedia,
- email verification berjalan end-to-end,
- register hard fail saat email gagal di production,
- auth audit log tersimpan formal,
- build dan test lintas package lulus.
