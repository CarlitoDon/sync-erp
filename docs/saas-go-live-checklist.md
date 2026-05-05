# Checklist: SaaS Go-Live

Last updated: 2026-05-05
Scope: Sync ERP public SaaS readiness
Target: private beta berbayar dulu, lalu public launch setelah blocker P0 selesai

## Cara Pakai

- Gunakan checklist ini sebagai sumber utama keputusan go-live.
- Jangan launch public jika masih ada item `P0` yang belum selesai.
- Untuk setiap item, isi bukti selesai di PR, issue, atau runbook terkait.
- Jika ada item yang ditunda, catat alasan dan risiko bisnisnya.

## Status Gate

- `P0` = blocker launch, harus selesai sebelum public launch.
- `P1` = sangat penting, idealnya selesai sebelum private beta scale.
- `P2` = improvement setelah private beta berjalan.

## P0: Billing Live

- [ ] Pilih payment/subscription provider utama.
  - Owner: Founder + Backend
  - Bukti selesai: keputusan provider terdokumentasi
- [ ] Tambahkan model subscription per tenant/company di database.
  - Owner: Backend
  - Bukti selesai: schema + migration + typecheck lulus
- [ ] Simpan state plan aktif, status subscription, renewal date, dan grace period.
  - Owner: Backend
  - Bukti selesai: field tersedia dan dipakai di backend
- [ ] Implement checkout flow untuk upgrade dari trial ke plan berbayar.
  - Owner: Backend + Frontend
  - Bukti selesai: user bisa checkout end-to-end di staging
- [ ] Implement webhook subscription untuk paid, failed, canceled, expired.
  - Owner: Backend
  - Bukti selesai: webhook test pass untuk 4 skenario utama
- [ ] Hubungkan limit enforcement ke plan aktif, bukan ke default statis.
  - Owner: Backend
  - Bukti selesai: `DEFAULT_BILLING_PLAN_KEY` tidak lagi menjadi sumber kebenaran runtime
- [ ] Tampilkan billing status nyata di halaman billing.
  - Owner: Frontend
  - Bukti selesai: current plan, next renewal, usage, dan CTA tersedia
- [ ] Uji downgrade, upgrade, cancel, dan gagal bayar.
  - Owner: QA + Backend
  - Bukti selesai: test matrix dan hasil validasi terdokumentasi

## P0: Security Minimum

- [ ] Ganti rate limit in-memory ke Redis/distributed store untuk auth dan endpoint publik.
  - Owner: Backend
  - Bukti selesai: register/login memakai backend store terdistribusi
- [ ] Tambahkan CSRF protection untuk mutation berbasis cookie session.
  - Owner: Backend
  - Bukti selesai: seluruh mutation sensitif tervalidasi CSRF
- [ ] Audit route sensitif untuk memastikan `companyId` dan membership selalu divalidasi.
  - Owner: Backend
  - Bukti selesai: audit sheet per router/service
- [ ] Review session policy: expiry, revocation, logout, rotation.
  - Owner: Backend
  - Bukti selesai: policy tertulis + implementasi diverifikasi
- [ ] Review API key scope, expiry default, dan abuse handling.
  - Owner: Backend
  - Bukti selesai: API key lifecycle terdokumentasi
- [ ] Pastikan secret production tidak hardcoded dan semua credential lewat secret manager/GitHub Secrets.
  - Owner: DevOps
  - Bukti selesai: audit config production selesai

## P0: Backup dan Recovery

- [ ] Tentukan strategi backup harian production.
  - Owner: DevOps
  - Bukti selesai: runbook backup tersedia
- [ ] Tentukan target RPO dan RTO sederhana.
  - Owner: Founder + DevOps
  - Bukti selesai: angka target tertulis
- [ ] Buat runbook restore ke staging.
  - Owner: DevOps
  - Bukti selesai: langkah restore terdokumentasi
- [ ] Jalankan minimal 1 restore drill penuh.
  - Owner: DevOps + Backend
  - Bukti selesai: restore drill berhasil dan dicatat
- [ ] Verifikasi integritas data setelah restore.
  - Owner: QA + Backend
  - Bukti selesai: sanity check transaksi inti lulus

## P0: Observability

- [ ] Integrasikan error tracking untuk backend.
  - Owner: Backend
  - Bukti selesai: exception production muncul di dashboard monitoring
- [ ] Integrasikan error tracking untuk frontend.
  - Owner: Frontend
  - Bukti selesai: error UI muncul di dashboard monitoring
- [ ] Tambahkan alerting untuk error rate, availability, dan auth anomaly.
  - Owner: DevOps
  - Bukti selesai: minimal 3 alert aktif
- [ ] Tambahkan dashboard metrik minimum.
  - Owner: DevOps + Backend
  - Bukti selesai: dashboard tersedia untuk error, latency, traffic
- [ ] Gunakan correlation ID secara konsisten di log/error tracking.
  - Owner: Backend
  - Bukti selesai: sample trace bisa dicari end-to-end

## P0: Legal dan Trust

- [ ] Buat `Privacy Policy`.
  - Owner: Founder + Legal
  - Bukti selesai: dokumen siap publish
- [ ] Buat `Terms of Service`.
  - Owner: Founder + Legal
  - Bukti selesai: dokumen siap publish
- [ ] Tetapkan kebijakan data retention dan deletion.
  - Owner: Founder + Backend
  - Bukti selesai: policy tertulis
- [ ] Tetapkan kontak support resmi.
  - Owner: Founder
  - Bukti selesai: email/form support aktif di web

## P1: Customer Readiness

- [ ] Rapikan halaman billing untuk customer non-teknis.
  - Owner: Frontend
  - Bukti selesai: billing page mudah dibaca dan tidak placeholder
- [ ] Siapkan onboarding admin pasca registrasi.
  - Owner: Product + Frontend
  - Bukti selesai: user tahu langkah berikutnya setelah setup
- [ ] Siapkan demo data/seed untuk sales demo.
  - Owner: Backend + Product
  - Bukti selesai: demo account bisa dipakai kapan saja
- [ ] Perjelas error state dan empty state di flow utama.
  - Owner: Frontend
  - Bukti selesai: QA walkthrough tanpa dead-end
- [ ] Sediakan export data dasar untuk customer.
  - Owner: Backend + Frontend
  - Bukti selesai: minimal export CSV untuk data inti

## P1: Operasional Support

- [ ] Buat SOP incident.
  - Owner: Founder + DevOps
  - Bukti selesai: severity, owner, dan template komunikasi ada
- [ ] Buat SOP support.
  - Owner: Founder + Ops
  - Bukti selesai: alur bug, billing, akses akun, dan refund tertulis
- [ ] Buat changelog internal untuk setiap deploy production.
  - Owner: Engineering
  - Bukti selesai: template release note aktif

## P1: Product Confidence

- [ ] Tambahkan smoke test production untuk login.
  - Owner: QA + Backend
  - Bukti selesai: smoke test pasca deploy jalan
- [ ] Tambahkan smoke test production untuk create transaksi inti.
  - Owner: QA + Backend
  - Bukti selesai: minimal 3 flow penting tervalidasi
- [ ] Tambahkan audit tambahan untuk tenant isolation pada router sensitif.
  - Owner: Backend
  - Bukti selesai: coverage audit bertambah
- [ ] Lakukan load test ringan untuk auth dan dashboard.
  - Owner: DevOps + Backend
  - Bukti selesai: hasil load test terdokumentasi

## P2: Commercial Polish

- [ ] Tambahkan invoice/receipt pembayaran SaaS.
  - Owner: Backend + Frontend
  - Bukti selesai: customer menerima bukti pembayaran
- [ ] Tambahkan dunning flow untuk pembayaran gagal.
  - Owner: Backend
  - Bukti selesai: reminder otomatis berjalan
- [ ] Tambahkan self-serve upgrade/downgrade yang lengkap.
  - Owner: Backend + Frontend
  - Bukti selesai: user bisa ubah plan tanpa bantuan manual
- [ ] Tambahkan analytics funnel onboarding dan aktivasi.
  - Owner: Product + Frontend
  - Bukti selesai: metrik funnel terlihat di dashboard analytics

## Definition of Ready: Private Beta Berbayar

- [ ] Semua item `P0` selesai.
- [ ] Minimal 3 smoke test production lulus.
- [ ] Minimal 1 restore drill lulus.
- [ ] Billing live berjalan di staging dan production.
- [ ] Privacy Policy dan Terms siap publish.
- [ ] Support contact dan incident owner jelas.

## Definition of Ready: Public SaaS Launch

- [ ] Seluruh `P0` selesai dan stabil.
- [ ] Minimal 80% `P1` selesai.
- [ ] Tidak ada blocker severity tinggi yang terbuka.
- [ ] Monitoring dan alerting sudah dipakai minimal 7 hari.
- [ ] Billing lifecycle sudah terbukti untuk skenario normal dan gagal bayar.
- [ ] Founder siap menerima customer self-serve tanpa onboarding manual penuh.
