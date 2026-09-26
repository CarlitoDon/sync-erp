# Repository Agent Policy

These repository-specific instructions are subordinate to higher-priority system, developer, and user instructions.

## Goal, Branch & Deployment Workflow

- **Local Development (`dev` / feature branches)**:
  - Seluruh pengerjaan fitur, perbaikan bug, dan pengujian dilakukan pada dev server lokal (`npm run dev:api`, `npm run dev:web`, dll.).
  - Database lokal menggunakan Docker Postgres/Redis lokal atau instance test.
  - Direct commits dan feature branches (`feat/`, `fix/`, `chore/`) dapat di-push ke `dev` untuk sinkronisasi tanpa memicu deployment otomatis ke staging.
- **Staging Environment (Frozen)**:
  - Environment staging dibekukan (stopped) untuk menghemat CPU, RAM, dan suhu host Mac.
  - Deployment ke staging dinonaktifkan di CI/CD dan webhook Coolify.
- **Production (`main`)**:
  - Direct push ke `main` tetap terlindungi (protected).
  - Promosi fitur/perbaikan dilakukan via Pull Request (PR) dari `dev` atau feature branch ke `main`.
  - Setelah PR di-merge ke `main`, GitHub Actions menjalankan Quality Gates (typecheck, lint, test, build), lalu otomatis men-deploy ke Coolify Production (`sync-erp.khusnudhoni.online`).

## Delegation

- Perform implementation, review, and verification through subagents.
- Prefer `gpt-5.6-luna` with `xhigh` reasoning and priority/fast service when available.
- The main agent orchestrates the work and reports the evidence and status.

## Safety and scope

- Preserve unrelated user changes.
- Do not stage environment files, cookies, deployment archives, generated output, or audit documents without explicit approval.
- Do not rotate credentials, mutate providers or production, delete tracked artifacts, or rewrite history without explicit authority and the required runbook gates.
- Keep local code-gate completion distinct from production incident closure.

## Validation and handoff

- Use path-limited staging and verify staged names, staged diff, and relevant tests before committing.
- After merge, verify that `dev` contains the PR merge and verify the branch state before completing the goal.
