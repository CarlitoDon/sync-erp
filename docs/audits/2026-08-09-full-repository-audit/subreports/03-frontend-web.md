# Audit Frontend Web — `apps/web`

Tanggal audit: 2026-08-09  
Scope: React architecture, routing, state/data fetching, forms, auth, accessibility, responsive UX, error/loading states, performance/bundle, component/test quality, dan frontend security.

## Scope & method

Audit dilakukan terhadap working tree saat ini secara read-only. Pemeriksaan mencakup konfigurasi Vite/Vitest/Playwright, provider dan router global, auth/company context, primitive UI yang dipakai lintas fitur, beberapa halaman berisiko tinggi, upload/diagram, serta workflow CI yang memanggil web test. `apps/api` hanya dibaca pada boundary auth/admin yang menentukan risiko frontend.

Verifikasi yang dijalankan tanpa build atau coverage (keduanya berpotensi menulis generated artifacts):

```text
npx tsc --noEmit -p apps/web/tsconfig.json                    -> exit 0
npm run lint --workspace=@sync-erp/web                         -> exit 0
npm run test --workspace=@sync-erp/web                        -> 22 files, 179 tests passed
(cd apps/web && npx playwright test --list)                   -> Error: No tests found; Total: 0 tests in 0 files
```

Tidak ada product code, config, lockfile, branch, remote, atau generated artifact yang diubah oleh audit ini. Report ini adalah satu-satunya file yang dibuat untuk scope ini.

## Current-state map

| Area | Kondisi terverifikasi |
|---|---|
| Runtime/architecture | Vite SPA dengan React 18, React Router 6, Tailwind, tRPC + TanStack Query, React Hook Form, dan Sentry. Entry point `apps/web/src/main.tsx` memakai `StrictMode`, `BrowserRouter`, dan error boundary. |
| Routing | Public routes (marketing/legal/auth), company selection/onboarding, lalu satu `ProtectedRoute` + `Layout` untuk dashboard dan feature routes. Fitur utama dipisah per folder dan banyak page di-lazy-load; marketing, auth, dan Dashboard masih eager di `apps/web/src/app/AppRouter.tsx:6-15`. Tidak ada catch-all/404 route (`:59-115`). |
| Auth/company | Cookie credentials (`credentials: 'include'`) dan CSRF token untuk mutation tersedia di `apps/web/src/lib/trpcProvider.tsx:108-136`. Company dipilih di localStorage dan dikirim sebagai `x-company-id` (`:103-106`); query key tidak terlihat memasukkan company ID. |
| State/data fetching | Provider global memakai satu `QueryClient` dengan `staleTime` 30 detik dan `gcTime` 5 menit (`apps/web/src/lib/trpcProvider.tsx:18-30`). Pergantian company melakukan invalidasi global (`apps/web/src/contexts/CompanyContext.tsx:53-65`), sedangkan logout terutama membersihkan auth query (`apps/web/src/contexts/AuthContext.tsx:83-89`). |
| Forms/components | Ada primitive bersama `Input`, `Select`, `Dialog`, `FormModal`, `ConfirmModal`, `Button`, serta feature-level hooks. Namun beberapa primitive custom belum memenuhi keyboard/ARIA/focus contract yang konsisten. |
| Tests | Unit/component suite aktif dan lulus, tetapi test terkonfigurasi hanya dari `test/**/*` sementara file E2E berada di `e2e-tests/`. Coverage threshold hanya lines/statements 80% (`apps/web/vitest.config.ts:17-41`), tanpa branch/function threshold. |
| Delivery/security | `vercel.json` hanya mengatur build/output/rewrite, tanpa header security eksplisit. Vite mendefinisikan secret server ke bundle client. Existing `dist` adalah ignored artifact; fresh build sengaja tidak dijalankan. |

## Findings table

| ID | Severity / confidence | Evidence konkret | Impact | Recommendation |
|---|---|---|---|---|
| F-01 | **P1 / High** | Route admin hanya dibungkus generic `ProtectedRoute` (`apps/web/src/app/AppRouter.tsx:89-102`; `apps/web/src/features/admin/routes.tsx:8-16`). Semua procedure admin memakai `protectedProcedure` (`apps/api/src/trpc/routers/admin.router.ts:21-54,123-160,227-264`), yang hanya memeriksa user + company (`apps/api/src/trpc/trpc.ts:149-169`); `AdminService` tidak melakukan role check (`apps/api/src/modules/admin/service.ts:38-90`). | Member company berpotensi membaca/replay data observability yang dimaksudkan untuk admin; hidden navigation bukan boundary security. | Enforce role/permission server-side untuk seluruh admin router; tambahkan `RoleProtectedRoute` untuk UX dan negative tests sebagai non-admin. |
| F-02 | **P1 / Medium-High** | Mermaid diinisialisasi `securityLevel: 'loose'` + `htmlLabels: true` (`apps/web/src/components/ui/MermaidDiagram.tsx:11-40`), lalu SVG disuntikkan via `dangerouslySetInnerHTML` (`:145-161`). `grn.number` dan `invoiceNumber` masuk label HTML hanya dengan escape quote (`apps/web/src/features/procurement/components/POTimelineMermaid.tsx:70-92,154-195`). | Business identifiers yang dapat dipengaruhi user/import dapat menjadi stored HTML/SVG/XSS saat diagram dilihat user lain. | Gunakan strict security level, matikan HTML labels, escape/sanitize allowlist, dan uji payload `<img/onerror>`/SVG pada identifier. |
| F-03 | **P1 / Medium** | `loadEnv(..., '')` memuat semua env (`apps/web/vite.config.ts:34`), lalu `SYNC_ERP_API_SECRET` didefinisikan ke client (`:69-78`). Secret tersebut dipakai sebagai auth server (`packages/shared/src/config/environment.ts:47-69`) dan diekspor dari shared browser alias (`packages/shared/src/index.ts:1-12`). Scan existing ignored `apps/web/dist` tidak menemukan literal secret; exposure pada fresh deployment belum terverifikasi. | Jika env secret diisi, Vite dapat menanamkannya sebagai literal yang dapat diekstrak dari browser; ini merupakan jalur credential disclosure, meski shipped exposure saat audit belum terbukti. | Hapus define secret dan import server config dari browser; hanya expose `VITE_*` yang memang public; scan artifact build sebelum deploy. |
| F-04 | **P1 / Medium** | Satu `QueryClient` global memakai cache key tRPC tanpa company scope yang tampak (`apps/web/src/lib/trpcProvider.tsx:18-30`). Company hanya dikirim dari localStorage header (`:103-106`); switch hanya `utils.invalidate()` (`apps/web/src/contexts/CompanyContext.tsx:53-65`), logout tidak clear seluruh cache (`apps/web/src/contexts/AuthContext.tsx:83-89`). | Data company/user lama dapat sempat ditampilkan saat switch/login cepat dan berisiko menjadi stale cross-tenant disclosure. Actual runtime leakage dan server authorization belum diuji. | Scope query key/input dengan user+company, clear/remove queries saat logout dan switch, tahan render sampai refetch selesai, lalu uji dua user/two-company. |
| F-05 | **P1 / High** | Playwright mencari `./test/e2e` (`apps/web/playwright.config.ts:3-18`), tetapi test berada di `apps/web/e2e-tests/landing.spec.ts`. Command menghasilkan `Error: No tests found; Total: 0 tests in 0 files`. CI menjalankan command yang tidak ada dan mengubah failure menjadi sukses (`.github/workflows/e2e-playwright.yml:63-68`). | Routing, auth, responsive, browser security, dan deep-link regression tidak menjadi release gate walaupun job bernama E2E. | Samakan `testDir`/lokasi dan tambahkan `test:e2e`; fail bila zero tests atau command gagal; hapus `continue-on-error` setelah suite minimal tersedia. |
| F-06 | **P1 / High** | Shared `Input` menerima `label` tetapi `<label>` tidak punya `htmlFor` dan input tidak diberi generated id (`apps/web/src/components/ui/input.tsx:51-75`); error/helper juga tidak terhubung dengan `aria-describedby`/`aria-invalid`. Test register bahkan memakai workaround karena label tidak punya `htmlFor` (`apps/web/test/features/auth/RegisterPage.test.tsx:57-61`). | Screen reader tidak mendapat hubungan label-field yang benar; error form tidak diumumkan secara programatik pada banyak form ERP. | Generate id stabil (`useId`/prop), set `htmlFor`, `aria-invalid`, `aria-describedby`, dan jadikan error `role=alert`/live region seperlunya. |
| F-07 | **P1 / High** | `Select` merender option sebagai `<div onClick>` tanpa role/keyboard semantics (`apps/web/src/components/ui/Select.tsx:190-202,247-282`); trigger tidak punya `aria-expanded`/`aria-controls` (`:291-322`). `Dialog` tidak punya role/modal/focus handling (`apps/web/src/components/ui/Dialog.tsx:15-35`), dan `ConfirmModal` juga tidak punya role/focus trap/Escape (`apps/web/src/components/ui/ConfirmModal.tsx:78-118`). | Keyboard-only dan assistive-tech users dapat gagal memilih data, keluar dari modal, atau mengetahui state control; ini memengaruhi flow transaksi dan destructive actions. | Prefer native `<select>` atau implement ARIA combobox/listbox lengkap; konsolidasikan dialog primitive dengan labelledby, focus trap/restore, Escape, scroll lock, dan axe/keyboard tests. |
| F-08 | **P2 / High** | Tidak ada `*` route di `apps/web/src/app/AppRouter.tsx:59-115`. `ProtectedRoute` menampilkan bare `Loading...` (`apps/web/src/features/auth/components/ProtectedRoute.tsx:17-23`); `IntegrationDetailPage` hanya punya loading/not-found tanpa query error (`apps/web/src/features/integrations/pages/IntegrationDetailPage.tsx:44-45,108-109`); auth menampilkan raw `error.message` (`apps/web/src/features/auth/components/LoginPage.tsx:60-63`, `apps/web/src/features/auth/components/VerifyEmailPage.tsx:40-70`). | URL salah dapat blank, error backend menjadi tidak konsisten/terlalu teknis, dan user tidak mendapat retry/action yang jelas. | Tambahkan NotFound, shared loading/error/empty states dengan `role=status`/`alert`, safe error mapping, retry, dan preserve intended location setelah login. |
| F-09 | **P2 / High** | Attachment membaca seluruh file ke base64 tanpa size/MIME guard (`apps/web/src/features/attachments/components/AttachmentPanel.tsx:81-98,215-234`); file input tidak memiliki `accept` (`:156-161`). Photo upload juga membaca `image/*` langsung ke base64 tanpa ukuran/dimensi limit (`apps/web/src/features/rental/components/PhotoUploader.tsx:48-59,84-100`). | Memory/network spike, payload besar, dan accidental unsupported files pada browser/mobile; server-side limit tidak terverifikasi dari frontend audit. | Validasi bytes/MIME/dimensi sebelum read, tetapkan batas backend, gunakan multipart/object storage atau presigned upload, dan tampilkan progress/cancel. |
| F-10 | **P2 / Medium** | API key header tidak wrap dan stats selalu `grid-cols-3` (`apps/web/src/features/settings/pages/ApiKeysPage.tsx:98-115`). Rental order table 8+ kolom berada langsung di `Card overflow-hidden`, tanpa `overflow-x-auto` (`apps/web/src/features/rental/pages/RentalOrdersPage.tsx:274-285,431-435`). Partner modal/table juga memakai `grid-cols-2` dan `Card overflow-hidden` tanpa mobile breakpoint/wrapper (`apps/web/src/features/common/components/PartnerListPage.tsx:188-238`). | Clipping/overflow dan form sempit pada viewport kecil; tindakan penting bisa keluar layar. | Tambahkan responsive stacking, `overflow-x-auto`/column priorities, dan browser checks pada 320/375/768 px. |
| F-11 | **P2 / Medium** | Marketing, auth, dan Dashboard eager di router (`apps/web/src/app/AppRouter.tsx:6-15`). Existing ignored dist menunjukkan entry sekitar 884 KiB dan chunk Mermaid/Cynefin sekitar 672 KiB, Cytoscape sekitar 436 KiB; fresh build belum dijalankan. `MarketingHomePage.tsx` sendiri 1.011 lines. | Initial download/parse dapat berat untuk landing/auth dan perubahan page besar sulit diisolasi; angka bundle adalah signal artifact lama, bukan fresh measurement. | Pisahkan public/app entry, lazy-load dashboard/auth/diagram dependencies sesuai route, tetapkan bundle budgets, dan ukur Web Vitals pada deployment. |
| F-12 | **P2 / Medium** | `apps/web/vercel.json:1-6` dan root `vercel.json:1-15` tidak menetapkan CSP, HSTS, frame-ancestors, Referrer-Policy, atau Permissions-Policy. Sentry Replay aktif saat DSN tersedia tanpa masking/block configuration eksplisit (`apps/web/src/lib/sentry.ts:42-58`). | Proteksi browser dan privacy posture deployment tidak dapat dibuktikan dari repo; replay dapat menangkap ERP form/PII tergantung default/org policy. | Set/verify headers di edge/hosting dengan CSP yang realistis; explicit mask/block sensitive inputs/text, sampling policy, dan privacy review untuk Sentry Replay. |
| F-13 | **P2 / Medium** | Unit suite lulus 179 test, tetapi source berjumlah 244 file vs 26 test files; feature matrix sangat timpang (rental/accounting/integrations/cash-bank banyak file tanpa test langsung). Coverage hanya lines/statements (`apps/web/vite.config.ts:106-124`, `apps/web/vitest.config.ts:23-42`), dan config test terduplikasi. | Pass rate saat ini tidak membuktikan route-level, mutation failure, mobile/a11y, tenant switching, dan high-risk diagrams. | Tambahkan coverage branch/function, contract tests untuk hooks/routers, E2E smoke per auth/company/core transaction, axe checks, dan jadikan satu source-of-truth Vitest config. |

## Detailed findings

### F-01 — Admin observability belum memiliki defense-in-depth authorization

**Verified fact:** `/admin/observability` dapat dirender oleh generic protected shell dan memanggil `trpc.admin.getOrphanJournals`; tidak ada role predicate di route web. Pada sisi API yang dibaca untuk memverifikasi boundary, admin procedures memakai `protectedProcedure`, sementara helper tersebut hanya mensyaratkan `ctx.userId` dan `ctx.companyId`. `AdminService` menerima `companyId` tetapi tidak memanggil policy role. `admin.policy.ts` memang ada, tetapi tidak terlihat dipakai oleh router ini.

**Inferred risk:** member biasa yang valid dapat membaca data operasional sensitif dan menjalankan replay mutation bila request berhasil. Ini perlu dikonfirmasi dengan akun non-admin pada environment test, tetapi source path sudah cukup untuk prioritas P1. Frontend role guard penting untuk UX, namun tidak menggantikan API authorization.

### F-02 — Diagram procurement menjadi HTML/SVG injection surface

`POTimelineMermaid` membentuk source Mermaid dari nomor GRN/invoice dan metadata. Escape hanya mengganti `"` dan newline; metadata sengaja menghasilkan `<small>`. Renderer mengizinkan HTML dan hasil SVG ditempelkan sebagai raw HTML. Walaupun exploitability bergantung pada parser Mermaid/version dan apakah identifier dapat dipengaruhi user atau import, kombinasi ini tidak boleh menjadi security boundary. Sanitasi output saja juga perlu disertai escaping input agar link/click directive tidak dapat dipalsukan.

### F-03 — Server secret masuk pipeline browser

`loadEnv` tanpa prefix membolehkan seluruh env tersedia di config. `define` kemudian membuat `process.env.SYNC_ERP_API_SECRET` menjadi compile-time replacement. Scan terhadap dist yang sudah ada tidak menemukan literal secret, sehingga temuan ini adalah **verified unsafe build path**, bukan klaim bahwa production bundle saat ini sudah bocor. Risiko tetap P1 karena jika variable terisi pada build dan direferensikan oleh shared import, nilai menjadi recoverable dari JavaScript publik.

### F-04 — Company context berada di luar identity query

Header `x-company-id` berubah berdasarkan localStorage, tetapi React Query cache identity tidak terlihat berubah. Invalidasi global membantu refetch, namun tidak menghapus data lama dan tidak mencegah stale result muncul selama transisi. Logout hanya membersihkan auth cache dan localStorage company. Backend harus tetap menjadi tenant boundary, tetapi UI tidak boleh menampilkan data dari cache context sebelumnya.

### F-05 — CI E2E adalah placeholder yang dapat selalu hijau

Konfigurasi dan lokasi file tidak cocok, command `test:e2e` tidak ada di `apps/web/package.json`, dan workflow menangkap seluruh failure dengan `echo` + `continue-on-error`. Karena command lokal menghasilkan zero tests, status hijau saat ini tidak berarti browser test telah dijalankan. Ini adalah gap paling konkret untuk routing/auth/responsive verification.

### F-06/F-07 — A11y primitive tidak konsisten

Ada fondasi yang baik pada beberapa area (misalnya `DatePicker` memakai generated id dan `Button` memiliki focus-visible styles), tetapi primitive yang paling luas dipakai justru bermasalah. `Input`, `Select`, `Dialog`, dan `ConfirmModal` membuat form dan destructive action tidak memiliki contract keyboard/screen-reader yang dapat diandalkan. `FormModal` sudah memiliki `role=dialog` dan `aria-modal`, tetapi masih belum mengelola Escape, focus trap, atau focus restore. Perbaikan sebaiknya dilakukan di primitive, bukan satu per satu pada page.

### F-08 — Async state dan navigation fallback belum menjadi design system

Sebagian page memiliki skeleton atau query error state, tetapi sebagian lain hanya memeriksa `isLoading`; `ApiKeysPage` misalnya membaca dua query tanpa error branch (`apps/web/src/features/settings/pages/ApiKeysPage.tsx:52-55`). Raw backend messages muncul di login/verification/dashboard/toast. Selain accessibility, raw error juga dapat membocorkan detail implementation jika backend mengembalikan message internal. Catch-all route perlu ditambahkan karena saat ini `Routes` berakhir tanpa `*`.

### F-09/F-10 — Payload dan viewport belum dibatasi sebagai first-class constraint

Base64 memperbesar payload dan menahan seluruh file di memory sebelum mutation. Pada mobile, ini berisiko lebih besar daripada desktop. Di sisi layout, beberapa komponen sudah memakai responsive utilities, tetapi tabel high-column dan stats API key belum punya fallback kecil. Ini memerlukan verification nyata, bukan hanya class inspection.

### F-11/F-12/F-13 — Performance, deployment hardening, dan test breadth

Route-level lazy loading sudah ada, tetapi public shell masih membawa eager imports dan artifact existing memperlihatkan dependency chart besar. Fresh production build/bundle analyzer belum dijalankan. Header security dan Sentry privacy juga bisa dikonfigurasi di luar repo, sehingga status deployment adalah unknown. Unit test quality cukup baik untuk primitives/auth/layout, namun belum proporsional dengan jumlah feature dan critical mutations.

## Strengths

- Feature boundaries dan route modules cukup jelas; banyak feature page sudah lazy-loaded melalui `LazyRoute`/`Suspense`.
- Cookie-based auth memakai `credentials: 'include'` dan mutation CSRF token; ini lebih kuat daripada menyimpan session token di localStorage (`apps/web/src/lib/trpcProvider.tsx:108-136`, `apps/web/src/lib/csrf.ts`).
- `ProtectedRoute` sudah memodelkan auth, company selection, dan onboarding state (`apps/web/src/features/auth/components/ProtectedRoute.tsx:26-50`).
- Sidebar memiliki fondasi responsive/mobile overlay dan navigation label; `Button` memiliki focus, disabled, active, dan reduced-motion styling.
- Consent gating untuk AdSense dilakukan sebelum script diaktifkan (`apps/web/src/App.tsx:9-18`), dan API key hanya dikembalikan sekali oleh API flow yang dibaca (`apps/api/src/trpc/routers/api-key.router.ts:57-65`).
- Static checks dan unit suite saat ini lulus: typecheck, lint, serta 179 test dari 22 file.

## Gaps/unknowns

- Belum ada browser run yang berhasil, sehingga visual responsive, focus order, real OAuth redirect, cookie attributes, deep-link fallback, dan runtime XSS belum terbukti.
- Actual production headers, CDN rewrite behavior, CSP compatibility, Sentry organization privacy settings, dan env secret values tidak dapat disimpulkan dari repo.
- Cache isolation perlu test dengan dua user dan dua company dalam tab/session yang sama; source inspection hanya membuktikan desain berisiko.
- Server-side file size/type limit, Mermaid sanitizer behavior pada versi ter-resolve, dan authorization middleware global di luar router yang dibaca perlu diuji pada environment test.
- Existing `apps/web/dist` di-ignore dan mungkin stale; ukuran bundle di atas hanya signal, bukan baseline deployment saat ini.
- Coverage tidak memiliki branch/function threshold; test name count tidak sama dengan route/feature risk coverage.
- Minor maintainability signals: `RegisterPage` mendeklarasikan `RegisterFormState` dua kali (`apps/web/src/features/auth/components/RegisterPage.tsx:18-24`), dan `AppRouter`/page components masih memiliki beberapa hotspot besar yang mencampur fetch, state, transform, dan markup.

## Prioritized recommendations

1. **Segera (P1):** pasang role/permission enforcement pada admin API dan role-aware route; hapus `SYNC_ERP_API_SECRET` dari Vite client define; perbaiki Playwright path/script dan buat zero-test/failure menjadi CI failure.
2. **Segera (P1):** harden Mermaid dengan strict mode + escaping/sanitization; perbaiki `Input`, `Select`, `Dialog`, dan `ConfirmModal` primitives dengan keyboard/ARIA/focus tests.
3. **Segera (P1):** scope/clear React Query cache berdasarkan user/company dan tambahkan two-company regression test; tambahkan `*` NotFound serta shared loading/error/alert states.
4. **Quick wins (P2):** file size/MIME/dimension guard, `accept` attribute, responsive table wrappers, mobile stacking API key stats/header, dan safe error mapping yang tidak menampilkan raw backend message.
5. **1–2 sprint:** pisahkan public/app entry, lazy-load chart dependencies, tetapkan bundle budget/Web Vitals, gunakan upload object storage/multipart, dan tambahkan Sentry masking plus security headers.
6. **Roadmap kualitas:** naikkan coverage ke branch/function, buat smoke E2E untuk login → company → dashboard → satu create/mutation, tambah axe/keyboard/mobile matrix, dan pecah page >400 lines menjadi container/hooks/presentational components.

## Suggested verification commands

Jalankan di checkout disposable atau environment test bila command menghasilkan artifacts:

```bash
# Static and unit baseline
npx tsc --noEmit -p apps/web/tsconfig.json
npm run lint --workspace=@sync-erp/web
npm run test --workspace=@sync-erp/web
npm run coverage --workspace=@sync-erp/web

# E2E discovery/gating after path correction
(cd apps/web && npx playwright test --list)
npm run test:e2e --workspace=@sync-erp/web

# Build secret and bundle inspection (writes dist)
npm run build:web
rg -n 'SYNC_ERP_API_SECRET|dev_sync_erp_secret_key_2026' apps/web/dist
du -ah apps/web/dist/assets | sort -h | tail -n 20

# Static security/a11y review
rg -n 'dangerouslySetInnerHTML|securityLevel|htmlLabels|process\.env\.SYNC_ERP_API_SECRET' apps/web/src apps/web/vite.config.ts
rg -n '<label|aria-(invalid|describedby|expanded|controls|selected)|role="(dialog|listbox|option|tab)"' apps/web/src/components apps/web/src/features

# Git hygiene after the audit
git diff --check
git status --short --untracked-files=all
```

Runtime acceptance tests yang disarankan: login dua user pada dua company, switch cepat lalu buka list/detail yang sama; akses `/admin/observability` sebagai member non-admin; masukkan identifier Mermaid berisi HTML; upload file oversized/non-image; jalankan keyboard-only pada Select/dialog/confirm; dan ukur 320/375/768 px serta fresh production bundle.
