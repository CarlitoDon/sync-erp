# Sync ERP Full Repository Audit Package

This directory contains the evidence package for the 2026-08-09 full repository, branch, runtime, quality, security, product, and operations audit.

## Start here

1. [Full repository audit](FULL-REPOSITORY-AUDIT.md) — executive verdict and reconciled synthesis.
2. [Risk register](RISK-REGISTER.md) — P0–P3 ownership and acceptance criteria.
3. [Roadmap](ROADMAP.md) — dependency-ordered containment, release, hardening, quality, architecture, and product phases.
4. [Repository snapshot](00-repository-snapshot.md) — commands, branch/runtime state, and measured verification results.

## Aspect reports

- [01 — Architecture and domain](subreports/01-architecture-domain.md)
- [02 — Backend API](subreports/02-backend-api.md)
- [03 — Frontend web](subreports/03-frontend-web.md)
- [04 — Database and Prisma](subreports/04-database-prisma.md)
- [05 — CI/CD and infrastructure](subreports/05-cicd-infrastructure.md)
- [06 — Testing and quality](subreports/06-testing-quality.md)
- [07 — Security, dependencies, and observability](subreports/07-security-dependencies-observability.md)
- [08 — Product, docs, and specifications](subreports/08-product-docs-specs.md)
- [09 — Git branches and governance](subreports/09-git-branches-governance.md)
- [10 — Bot, MCP, integrations, and scripts](subreports/10-bot-mcp-integrations-scripts.md)

## Reading rules

- The full report and risk register are authoritative where a subreport's wording differs; high-severity claims were cross-checked and any detected overstatement was corrected.
- `Verified` means directly observed in source, commands, or live read-only GitHub data. `Inferred` means impact/exploitability depends on runtime state. `Unknown` means the audit lacked safe read-only access to the required environment.
- Secret values are intentionally omitted. Any likely real value tracked in public history must be treated as compromised until rotated, regardless of whether it is printed here.
- No product code, configuration, lockfile, branch, remote, PR, or production system was changed by this audit.

