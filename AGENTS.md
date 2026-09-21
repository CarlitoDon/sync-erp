# Repository Agent Policy

These repository-specific instructions are subordinate to higher-priority system, developer, and user instructions.

## Goal, Branch & Deployment Workflow

- **Development (`dev`)**:
  - Direct commits and pushes to `dev` are allowed for rapid development and testing without requiring a PR.
  - Every commit pushed to `dev` automatically and immediately triggers deployment to Coolify Staging (`api`, `bot`, `mcp`) and Vercel Preview (`web`).
  - Feature branches (`feat/`, `fix/`, `chore/`) may still be used if desired, and can be merged directly to `dev` without requiring PR approvals.
- **Production (`main`)**:
  - Direct push to `main` remains protected.
  - Production releases are promoted from `dev` to `main` via PR, and will automatically deploy to Coolify Production upon merge once Quality Gates pass.

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
