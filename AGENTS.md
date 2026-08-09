# Repository Agent Policy

These repository-specific instructions are subordinate to higher-priority system, developer, and user instructions.

## Goal and PR workflow

- Start every new goal from the latest `origin/dev` on a new `codex/` branch.
- A goal is complete only after its PR targeting `dev` is merged and the merge is verified on remote `dev`.
- Finish implementation, review, and verification before committing; then push the branch, open the PR to `dev`, and wait for CI, review, and merge.
- If CI or review fails, keep the goal active or blocked; never mark it complete.
- Never push directly to `dev` or `main`.
- After merge, start the next goal from the updated `origin/dev`, not from the old goal branch.

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
