# Roadmap: 30 Hari Menuju SaaS Launch

Last updated: 2026-05-05
Scope: Sync ERP
Goal utama: siap private beta berbayar dalam 30 hari, dengan jalur jelas menuju public SaaS launch

## Prinsip Eksekusi

- Fokus dulu ke blocker yang menghambat uang masuk, keamanan, dan recovery.
- Jangan buka self-serve public launch sebelum semua pekerjaan `P0` selesai.
- Setiap minggu harus menghasilkan output yang bisa diuji, bukan hanya desain atau diskusi.
- Jika resource terbatas, prioritaskan reliability dan billing dibanding fitur baru.

## Asumsi Tim

- Founder / PM: keputusan bisnis, legal, pricing, launch.
- Backend: subscription, webhook, security, observability backend.
- Frontend: billing UI, support UI, polish onboarding, error states.
- DevOps: secrets, Redis, monitoring, backup, restore, deploy.
- QA: test matrix, smoke test, validasi staging/production.

## Ringkasan Prioritas

1. Billing live dan subscription state per tenant.
2. Security hardening minimum untuk auth dan endpoint publik.
3. Backup/restore dan observability production.
4. Customer readiness untuk private beta berbayar.

## Minggu 1: Billing Foundation

### Target

- Subscription model nyata tersedia.
- Checkout flow dan webhook dasar hidup di staging.
- Plan enforcement tidak lagi bergantung pada default statis.

### Pekerjaan

- Backend
  - Desain model subscription, invoice state, payment state, grace period.
  - Tambahkan migration dan service layer billing runtime.
  - Hubungkan enforcement limit ke plan aktif tenant.
  - Buat webhook handler untuk event provider utama.
- Frontend
  - Ubah halaman billing agar membaca status nyata.
  - Tambahkan CTA trial, upgrade, status plan, dan renewal date.
- Founder / PM
  - Finalkan paket plan, trial policy, dan upgrade rule.
  - Finalkan provider pembayaran yang dipakai dulu.
- QA
  - Buat test matrix:
    - trial
    - upgrade berhasil
    - webhook sukses
    - payment gagal
    - cancel

### Deliverable

- User bisa subscribe dari staging.
- Tenant punya plan aktif yang tersimpan di database.
- Limit berjalan sesuai plan.

### Exit Criteria

- Typecheck dan test lulus.
- Checkout staging berhasil.
- Webhook utama tervalidasi.

## Minggu 2: Security dan Operational Safety

### Target

- Auth/public endpoint lebih aman.
- Ada jalur recovery yang benar-benar bisa dipakai.

### Pekerjaan

- Backend
  - Ganti rate limit in-memory ke Redis/distributed store.
  - Tambahkan CSRF protection untuk mutation cookie-based.
  - Review session policy dan API key policy.
  - Audit router yang sensitif terhadap tenant isolation.
- DevOps
  - Provision Redis / managed cache untuk rate limiting.
  - Susun backup schedule production.
  - Buat restore runbook ke staging.
  - Jalankan 1 restore drill.
- QA
  - Uji abuse basic:
    - brute-force login
    - repeated register
    - repeated resend verification
    - invalid CSRF

### Deliverable

- Rate limiting distributed aktif.
- Restore dari backup berhasil ke staging.
- Security minimum tidak lagi bergantung pada memory lokal server.

### Exit Criteria

- Abuse test dasar lulus.
- Restore drill tercatat dan berhasil.
- Tidak ada route sensitif tanpa guard tenancy yang jelas.

## Minggu 3: Observability dan Production Confidence

### Target

- Error produksi bisa terlihat dan ditindak.
- Deploy tidak lagi buta setelah rilis.

### Pekerjaan

- Backend
  - Integrasikan error tracking backend.
  - Tambahkan context correlation ID ke log/error.
  - Tambahkan metrik error dan latency minimum.
- Frontend
  - Integrasikan error tracking frontend.
  - Rapikan error boundary, async failure handling, dan state fallback.
- DevOps
  - Tambahkan alerting untuk:
    - error spike
    - availability
    - auth anomaly
  - Buat dashboard minimum untuk production.
- QA
  - Buat smoke test pasca deploy:
    - login
    - pilih company
    - onboarding / dashboard load
    - create transaksi inti

### Deliverable

- Tim bisa tahu cepat saat production rusak.
- Ada smoke test yang bisa dipakai setelah deploy.

### Exit Criteria

- Error test sengaja muncul dan masuk monitoring.
- Dashboard production aktif.
- Smoke test pasca deploy lulus.

## Minggu 4: Launch Readiness

### Target

- Siap menjalankan private beta berbayar dengan proses support yang realistis.

### Pekerjaan

- Founder / PM
  - Buat `Privacy Policy` dan `Terms of Service`.
  - Pilih 3-5 founding customers.
  - Tentukan SLA internal dan support channel.
- Frontend
  - Rapikan halaman billing, onboarding, dan empty states.
  - Tambahkan support/contact link yang jelas.
- Backend
  - Pastikan export data dasar tersedia.
  - Pastikan audit log dan error handling cukup untuk support kasus nyata.
- DevOps
  - Final audit secrets, deploy, dan alerting.
  - Buat release checklist production.
- QA
  - Jalankan regression final:
    - auth
    - onboarding
    - billing
    - transaksi inti
    - API key basic

### Deliverable

- Produk siap dijual ke batch pertama customer.
- Tim punya SOP dasar saat ada bug, gangguan, atau issue billing.

### Exit Criteria

- Semua `P0` dari checklist selesai.
- Tidak ada blocker severity tinggi yang terbuka.
- Founding customer siap di-onboard.

## Owner Map

## Founder / PM

- Pricing, packaging, legal, support model
- Keputusan launch gate
- Seleksi founding customer

## Backend

- Subscription model
- Payment webhook
- Limit enforcement
- CSRF dan security backend
- Audit tenancy

## Frontend

- Billing page runtime
- UX support dan error state
- Monitoring frontend

## DevOps

- Redis
- Monitoring
- Alerting
- Backup/restore
- Secret audit

## QA

- Test matrix billing
- Smoke test production
- Regression final

## Dependency Map

- Billing runtime harus selesai sebelum private beta berbayar.
- Redis rate limiting harus selesai sebelum traffic publik.
- Observability harus aktif sebelum menerima banyak tenant.
- Backup/restore harus selesai sebelum menyimpan data customer aktif.
- Legal docs harus siap sebelum public launch.

## Risiko Utama

- Billing selesai setengah jalan lalu launch dipaksa.
  - Dampak: customer bayar tetapi entitlement kacau.
- Monitoring tidak siap.
  - Dampak: bug production terlambat diketahui.
- Backup tidak pernah diuji.
  - Dampak: recovery gagal saat insiden nyata.
- Security hardening ditunda.
  - Dampak: brute force, abuse, atau bug session berdampak lebih besar.

## Scope yang Ditahan Dulu

- Enterprise contract workflow penuh.
- Custom SLA contract automation.
- Advanced analytics dan growth automation.
- Marketplace/integration expansion di luar kebutuhan customer awal.

## Definition of Success Setelah 30 Hari

- Produk siap untuk private beta berbayar.
- Ada 3-5 customer awal yang bisa di-onboard dengan risiko operasional yang terkendali.
- Billing, monitoring, backup, dan support minimum sudah berjalan.
- Tim punya keputusan jelas apakah lanjut ke public launch atau tetap private beta 2-4 minggu lagi.
