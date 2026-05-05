# Tasks: SaaS Launch Execution

Last updated: 2026-05-05
Source: `docs/saas-go-live-checklist.md` dan `docs/saas-launch-roadmap.md`

## Sprint 0: Dokumen dan Keputusan

- [ ] Finalkan provider subscription/payment yang dipakai dulu.
- [ ] Finalkan rule trial, grace period, dan cancel policy.
- [ ] Finalkan definisi launch gate private beta vs public launch.
- [ ] Tetapkan owner operasional per area: Founder, Backend, Frontend, DevOps, QA.

## Sprint 1: Billing Foundation

### Backend

- [ ] Tambahkan model subscription/billing runtime ke Prisma.
- [ ] Tambahkan enum status subscription yang dibutuhkan.
- [ ] Tambahkan migration/schema update dan regenerate Prisma client.
- [ ] Buat helper/service untuk memastikan setiap company punya billing profile/subscription runtime.
- [ ] Update `billing.getOverview` agar membaca state subscription nyata.
- [ ] Hapus ketergantungan runtime pada default plan statis untuk current workspace.
- [ ] Hubungkan limit enforcement ke plan aktif tenant.
- [ ] Tambahkan endpoint internal untuk update status subscription dari provider webhook.

### Frontend

- [ ] Update halaman billing agar menampilkan:
  - current plan
  - status subscription
  - trial end
  - period end / renewal
  - grace period bila ada
- [ ] Rapikan state loading dan unavailable state untuk billing page.

### QA

- [ ] Validasi company baru otomatis punya billing state awal.
- [ ] Validasi company existing tetap aman setelah schema billing ditambahkan.
- [ ] Validasi current plan berubah jika subscription runtime berubah.

## Sprint 2: Checkout dan Webhook

### Backend

- [ ] Integrasikan provider checkout session / payment link.
- [ ] Simpan provider customer ID dan provider subscription ID.
- [ ] Implement webhook verification/signature check.
- [ ] Tangani event:
  - trial started
  - subscription active
  - payment failed
  - canceled
  - expired
- [ ] Tambahkan idempotency untuk webhook billing.

### Frontend

- [ ] Tambahkan CTA upgrade yang menuju checkout nyata.
- [ ] Tambahkan success/cancel return state dari checkout.

### QA

- [ ] Uji checkout berhasil.
- [ ] Uji checkout dibatalkan.
- [ ] Uji webhook dipanggil dua kali.
- [ ] Uji payment failed mengubah status sesuai harapan.

## Sprint 3: Security Hardening

### Backend

- [ ] Migrasikan rate limit auth ke Redis/distributed store.
- [ ] Tambahkan CSRF protection untuk cookie-based mutation.
- [ ] Review session expiry dan revoke policy.
- [ ] Audit tenant isolation di router sensitif.
- [ ] Audit API key scope dan expiry.

### DevOps

- [ ] Provision Redis.
- [ ] Tambahkan environment variable yang dibutuhkan.

### QA

- [ ] Uji brute-force login.
- [ ] Uji abuse pada register/resend verification.
- [ ] Uji request mutation tanpa CSRF token valid.

## Sprint 4: Backup, Monitoring, dan Support

### DevOps

- [ ] Buat backup strategy production.
- [ ] Buat restore runbook.
- [ ] Jalankan restore drill ke staging.
- [ ] Pasang error tracking frontend/backend.
- [ ] Pasang alerting minimum.
- [ ] Buat dashboard operasional minimum.

### Frontend

- [ ] Sambungkan logger frontend ke error tracking.

### Backend

- [ ] Pastikan correlation ID ikut ke log/error event.

### QA

- [ ] Verifikasi alerting dan capture error berjalan.
- [ ] Verifikasi restore hasilnya usable.

## Sprint 5: Launch Readiness

### Founder / PM

- [ ] Buat `Privacy Policy`.
- [ ] Buat `Terms of Service`.
- [ ] Tetapkan support channel.
- [ ] Pilih founding customers.

### Frontend

- [ ] Tambahkan support/contact link.
- [ ] Rapikan error state dan onboarding hints.

### Backend

- [ ] Tambahkan export data dasar untuk customer.
- [ ] Pastikan audit log cukup untuk support/debug.

### QA

- [ ] Jalankan smoke test final:
  - login
  - company selection
  - billing page
  - onboarding
  - create transaksi inti

## Exit Checklist: Private Beta

- [ ] Semua task Sprint 1 selesai.
- [ ] Task kritis Sprint 2 selesai.
- [ ] Task kritis Sprint 3 selesai.
- [ ] Backup/restore dan monitoring minimum aktif.
- [ ] Legal docs siap publish.
- [ ] Smoke test final lulus.

## Exit Checklist: Public Launch

- [ ] Semua private beta gate selesai.
- [ ] Payment failure flow sudah teruji.
- [ ] Monitoring sudah dipakai aktif minimal 7 hari.
- [ ] Tidak ada blocker severity tinggi terbuka.
- [ ] Support SOP berjalan.
