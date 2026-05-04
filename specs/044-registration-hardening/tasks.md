# Tasks 044: Registration Hardening & Account Activation

## Status Umum

Semua task utama pada scope ini telah diimplementasikan.

## Checklist

- [x] Perkuat validasi form registrasi frontend
- [x] Sinkronkan auth state frontend pasca-login/register
- [x] Arahkan flow auth ke onboarding company yang benar
- [x] Tambahkan rate limiting pada endpoint auth publik
- [x] Gunakan generic login error untuk mencegah account enumeration
- [x] Tambahkan status verifikasi email pada model user
- [x] Tambahkan model token verifikasi email
- [x] Tambahkan endpoint backend untuk verify email
- [x] Tambahkan endpoint backend untuk resend verification
- [x] Tambahkan halaman frontend untuk verify email
- [x] Tambahkan verify notice screen setelah registrasi
- [x] Blokir login untuk akun yang belum diverifikasi
- [x] Tambahkan mailer service dengan provider `log` dan `resend`
- [x] Terapkan policy hard fail email delivery di production
- [x] Tambahkan kompensasi register saat email gagal terkirim
- [x] Tambahkan audit log formal khusus auth
- [x] Catat auth events penting ke audit log formal
- [x] Tambahkan migration Prisma untuk email verification dan auth audit log
- [x] Tambahkan atau perbarui test unit dan frontend yang relevan
- [x] Perbarui dokumentasi env dan PRD

## Artefak Hasil

- PRD: `docs/prd/registration-hardening-prd.md`
- Spec: `specs/044-registration-hardening/spec.md`
- Tasks: `specs/044-registration-hardening/tasks.md`
- Migration Prisma:
  - `packages/database/prisma/migrations/20260504130000_add_auth_email_verification_and_audit/migration.sql`

## Verifikasi yang Harus Lulus

- [x] `npm run db:generate --workspace=@sync-erp/database`
- [x] `npm run test --workspace=@sync-erp/web -- test/features/auth/LoginPage.test.tsx test/features/auth/RegisterPage.test.tsx test/features/auth/ProtectedRoute.test.tsx test/components/layout/Layout.test.tsx test/components/layout/Sidebar.test.tsx`
- [x] `npm run test:unit --workspace=@sync-erp/api -- test/unit/auth.service.test.ts test/unit/email.service.test.ts test/unit/public-rate-limit.service.test.ts test/unit/idempotency.service.test.ts`
- [x] `npm run build:typecheck --workspace=@sync-erp/web`
- [x] `npm run build --workspace=@sync-erp/api`

## Sisa Operasional Release

Item berikut bukan gap implementasi kode, tetapi tetap harus dilakukan saat rollout:

- [ ] Isi env production email provider
- [ ] Jalankan migration Prisma ke database target
- [ ] Verifikasi domain/from-address provider email
- [ ] Jalankan smoke test staging end-to-end
