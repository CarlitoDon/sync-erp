# Checklist: Onboarding v1

## Product Acceptance

- Onboarding bisa diselesaikan end-to-end untuk business shape Retail.
- User bisa keluar di tengah onboarding dan resume dari step terakhir.
- Setelah onboarding selesai, user masuk dashboard normal dan sidebar terbuka.
- Onboarding tidak mengubah UI/akses untuk company yang sudah `ACTIVE`.

## Backend

- Ada migration Prisma untuk field onboarding pada `Company`.
- `company.selectShape` masih immutable dan tetap melakukan seeding (configs + CoA + default accounts).
- Opening balance journal idempotent (tidak ada duplikasi).
- Guided first transaction idempotent (tidak ada duplikasi).
- Semua endpoint onboarding memvalidasi precondition step dengan error yang konsisten.
- Audit log event onboarding tercatat untuk debug.

## Frontend

- Routing gate aktif:
  - semua halaman selain onboarding redirect ke `/onboarding` jika company belum `ACTIVE`.
- Layout onboarding tidak menampilkan sidebar.
- UI step handling:
  - loading state jelas
  - error state jelas + tombol retry
  - refresh state kalau step mismatch

## Observability

- Minimal 4 event tercatat:
  - started, step_completed, first_transaction_completed, completed
- Event mengandung `companyId`, `userId`, `step`.

## QA Scenarios

- New user → create company → Retail → onboarding selesai.
- User logout di step opening balance → login → kembali ke step opening balance.
- Submit opening balance 2x → journal tetap 1.
- Submit first transaction 2x → dokumen tetap 1.
- Company ACTIVE → tidak pernah dipaksa onboarding.

## Definition of Done

- CI lulus.
- Deploy web via CI/CD lulus.
- Deploy api via CI/CD lulus (jika ada perubahan backend).

