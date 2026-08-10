# Git, Branches, and Repository Governance Audit

Audit date: 2026-08-09 (Asia/Jakarta)  
Repository: CarlitoDon/sync-erp (https://github.com/CarlitoDon/sync-erp)  
Scope: local Git worktrees/refs/history plus live GitHub branch, PR, issue, protection, check, release, license, and governance state.  
Mutation boundary: no fetch, push, ref/branch/worktree/remote/GitHub mutation, cleanup, or code/config change was performed. Only this report file was written.

## Executive result

No P0 finding was established. The highest-risk governance issue is P1: protected main and dev require only the source-branch check, while live main commit 3631357aabb5cbbff61924260e49bdc8257ef0c0 has a failed Deploy API to Hostinger check. Required approvals are also configured as zero. The repository therefore has source-policy enforcement, but not a reliable human-review and deployment-quality gate.

The local checkout is materially stale relative to GitHub. Live dev is 6684ba78b2d2eb318b0d19c5c04fd82e2c3bba13, live main is 3631357aabb5cbbff61924260e49bdc8257ef0c0; the local cached tips remain 41bd42a9a832a49fdde41b7e56b1edbfb887fddd and 43f9acafda60ca3adfdce1d52524808d63e257b2. The active local branch additionally contains unpushed commit 70b7a218e71ce14e9730f8a69d27090bffd45015, and a second clean worktree contains alternative unpushed commits f0f89f63edf8e3248c78d98e6d2cc56afaa2879a and 66e9dfedbd241b351c026c0a7140d3ee40829ba0.

Live GitHub state: 11 branches, 2 protected (main, dev), 9 unprotected topic branches; 45 PRs (40 merged, 5 closed-unmerged, 0 open); 0 issues; no rulesets visible; no tags/releases; no license detected; branch deletion after merge disabled. Four local origin/* refs are stale, and the repository contains 45 hidden refs/original/* backup refs plus 88 unreachable commits.

## 1. Local worktrees and branch inventory

Evidence: git worktree list --porcelain, git status --short --branch, git branch -a -vv --no-abbrev, git for-each-ref, and git show-ref --head --dereference.

| Local object | SHA / state | Governance relevance |
|---|---|---|
| Main worktree /Users/wecik/Documents/Offline/Professional/Coding/sync-erp | fix/ci-use-npx at 70b7a218e71ce14e9730f8a69d27090bffd45015; ahead 1 of cached/live origin/fix/ci-use-npx at d10152c73c727a7fd836bacc27cc761f37555b07 | One unpushed workflow change; worktree also has untracked docs/audits/ from the parallel audit. |
| /private/tmp/sync-erp-codex-ci-prisma | codex/ci-prisma-artifact-20260809 at 66e9dfedbd241b351c026c0a7140d3ee40829ba0; no upstream; clean | Second local alternative for the same one-line CI migration command. |

Local branch heads (12):

| Local branch | Tip | Local/live status |
|---|---|---|
| codex/ci-prisma-artifact-20260809 | 66e9dfe | Local-only, not on a live remote branch, not merged into cached dev/main. |
| codex/fix-staging-database | 061d9ea | Same tip as live codex/fix-staging-database; content is integrated through merged PR #33 via the duplicate fix/staging-database-isolation branch. |
| dev | 41bd42a | Cached local tip; live GitHub tip is 6684ba7. |
| feat/dashboard-visual-refresh | 7fc973b | Live branch; PR #31 merged. |
| fix/ci-add-deploy-logging | f1bf59d | Live branch; its history is included in live dev/main. |
| fix/ci-cd-indentation-v3 | 8c434b6 | Live branch; PR #39 closed unmerged and tip is not in live dev/main. |
| fix/ci-dev-indentation | 69bb8e8 | Live branch; PR #40 merged. |
| fix/ci-prisma-symlink | 03dcf73 | Live branch; PR #42 merged. |
| fix/ci-use-npx | 70b7a21 | Local-only tip; live branch remains at d10152c. |
| fix/remove-stale-file | a8607d3 | Live branch; PR #41 merged. |
| fix/staging-database-isolation | 061d9ea | Live branch; PR #33 merged. |
| main | 43f9aca | Cached local tip; live GitHub tip is 3631357. |

Local ref hygiene:

- refs/remotes/origin has 16 refs including origin/HEAD; origin/HEAD still points to cached origin/main 43f9aca.
- Four cached remote-tracking refs are stale according to live git remote show origin: origin/fix/ci-yaml-indentation (1c6718c), origin/fix/deploy-api-prisma (0751a90), origin/fix/deploy-api-prisma-v2 (a05dea6), and origin/fix/deploy-staging-migrations (1bc1fa9).
- refs/original contains 45 hidden backup refs: 16 former local-head snapshots and 29 former remote snapshots. These are recovery refs, not ordinary branches; they were not deleted.
- There are 2 refs/codex/turn-diffs/* refs and 1 refs/stash (719a86485585f34ce9dbefb40aa79bef82cedb4e).
- git fsck --full --unreachable --no-reflogs --no-progress reports 88 unreachable commits, 350 trees, and 188 blobs. No reflog expiry, prune, or garbage collection was run.

## 2. Live remote branches and ancestry

Authoritative live evidence: git ls-remote --symref origin HEAD 'refs/heads/*' and GitHub GET /repos/CarlitoDon/sync-erp/branches?per_page=100.

Live branch tips at audit time:

| Branch | Live SHA | Protected |
|---|---|---:|
| main | 3631357aabb5cbbff61924260e49bdc8257ef0c0 | yes |
| dev | 6684ba78b2d2eb318b0d19c5c04fd82e2c3bba13 | yes |
| codex/fix-staging-database | 061d9ea8d32426eb2ce40e37b807871a859a14e4 | no |
| feat/dashboard-visual-refresh | 7fc973b95c939ec87145f11262774d903428ab2b | no |
| fix/ci-add-deploy-logging | f1bf59d87453379c7e1015f504640c325073ff50 | no |
| fix/ci-cd-indentation-v3 | 8c434b6214c6f87daad27b66ed5bae9736f1ae6b | no |
| fix/ci-dev-indentation | 69bb8e8005435c62a4f4803b6fe01e89c9628348 | no |
| fix/ci-prisma-symlink | 03dcf73c874b732dea2b0ba8129a2e9db5fbfa6f | no |
| fix/ci-use-npx | d10152c73c727a7fd836bacc27cc761f37555b07 | no |
| fix/remove-stale-file | a8607d331bd7108856bb01630bde2ec71c8395e1 | no |
| fix/staging-database-isolation | 061d9ea8d32426eb2ce40e37b807871a859a14e4 | no |

GitHub compare API results, kept separate from the stale local cache:

- Live dev compared with cached/local dev 41bd42a is ahead_by=8, behind_by=0; the eight live commits include the CI fix chain through merge commit 6684ba7.
- Live main compared with cached/local main 43f9aca is ahead_by=13, behind_by=0; the live tip 3631357 is a signed GitHub merge with parents 43f9aca and 6684ba7.
- Comparing live main...dev returns status=behind, behind_by=6, merge_base=6684ba7; live dev is an ancestor of live main, with six main-only commits after that ancestor.
- The local active branch is one commit ahead of the live fix/ci-use-npx tip. Commit 70b7a21 changes .github/workflows/ci-cd.yml and has no live branch or open PR. The temporary worktree contains two alternative commits (f0f89f6, then 66e9dfe) for the same migration command change; neither is live.

This is a cache divergence, not evidence that GitHub lost commits. The audit intentionally did not fetch, so local refs remain stale by design.

## 3. PR, issue, merge, and review state

Live REST evidence: GET /repos/CarlitoDon/sync-erp/pulls?state=all&per_page=100, GET /repos/CarlitoDon/sync-erp/issues?state=all&per_page=100, and per-PR review endpoints.

- 45 total PRs: 40 merged, 5 closed without merge, 0 open.
- Closed-unmerged PRs: [#39](https://github.com/CarlitoDon/sync-erp/pull/39) (fix/ci-cd-indentation-v3), [#32](https://github.com/CarlitoDon/sync-erp/pull/32) (draft codex/fix-staging-database), [#18](https://github.com/CarlitoDon/sync-erp/pull/18), [#13](https://github.com/CarlitoDon/sync-erp/pull/13), and [#4](https://github.com/CarlitoDon/sync-erp/pull/4).
- Recent merge chain: [#41](https://github.com/CarlitoDon/sync-erp/pull/41), [#42](https://github.com/CarlitoDon/sync-erp/pull/42), [#43](https://github.com/CarlitoDon/sync-erp/pull/43), [#44](https://github.com/CarlitoDon/sync-erp/pull/44), then [#45](https://github.com/CarlitoDon/sync-erp/pull/45). PR #45 merged dev into main at 3631357.
- There are 0 GitHub issues (the issues API returned 45 PR-shaped items and 0 non-PR issues).
- For PRs #33–#45, submitted reviews were from copilot-pull-request-reviewer[bot] with state COMMENTED; PR #32 had no submitted review. No human approval gate is visible in this range. This is consistent with repository protection reporting required_approving_review_count=0, but is not a claim about every older PR review event.

## 4. Protection, rulesets, checks, and access

Protection API evidence:

- GET /repos/CarlitoDon/sync-erp/branches/main/protection: strict required status check is only check-source-branch; required_approving_review_count=0; require_code_owner_reviews=false; dismiss_stale_reviews=true; admins enforced; force-pushes and deletions disabled; linear history, conversation resolution, and signed commits not required.
- GET /repos/CarlitoDon/sync-erp/branches/dev/protection: same policy, with check-source-branch reported with GitHub Actions app ID 15368.
- GET /repos/CarlitoDon/sync-erp/rulesets?includes_parents=true returned []; no visible repository or inherited ruleset exists for this token.
- GitHub branch listing marks only main and dev protected. All nine topic branches are unprotected.

Repository settings evidence from GET /repos/CarlitoDon/sync-erp:

- Public, not archived, default branch main; direct collaborators are CarlitoDon (admin) and DonCarlo3105 (write).
- delete_branch_on_merge=false; auto-merge disabled; merge commit, rebase, and squash merge all allowed; update-branch disabled.
- Dependabot security updates, secret scanning, secret-scanning push protection, and secret-scanning validity checks are disabled.
- Issues, projects, and wiki are enabled; discussions are disabled. Repository description is empty.

Live check evidence:

- Live main 3631357 has six check runs. Quality Gates (API), Quality Gates (Web), Playwright E2E, Detect Changed Areas, and Deploy Web to Vercel succeeded; Deploy API to Hostinger failed. Failure job: [Actions job 89950448133](https://github.com/CarlitoDon/sync-erp/actions/runs/30257188329/job/89950448133).
- Live dev 6684ba7 has 16 check runs, including successful check-source-branch, successful AI review/quality checks, and a failed Deploy API to Hostinger run; one API deploy run is also skipped.
- .github/workflows/ci-cd.yml:3-8 runs on PRs and pushes to main/dev, but protection does not require its quality or deployment contexts.
- .github/workflows/validate-pr-source.yml:3-18 allows PRs to main only from dev or cto/*; .github/workflows/validate-pr-dev.yml:3-24 allows PRs to dev only from feat/*, fix/*, chore/*, refactor/*, perf/*, or style/*.
- .github/workflows/e2e-playwright.yml:66-68 treats a missing E2E suite as a successful placeholder and uses continue-on-error: true; E2E is not a required protection context.
- .github/workflows/ai-review.yml:3-17 runs bot review for PRs to dev/main, but its comment result is not a required protection context.

## 5. Tags, releases, license, and repository policy files

- git ls-remote --tags --refs origin returned no tags.
- GET /repos/CarlitoDon/sync-erp/releases?per_page=100 returned no releases.
- gh repo view reports licenseInfo=null; GET /repos/CarlitoDon/sync-erp/license returned 404. No tracked LICENSE*, COPYING*, or NOTICE* file was found.
- No tracked CODEOWNERS, CONTRIBUTING*, CODE_OF_CONDUCT*, SECURITY.md, issue template, or pull-request template was found. docs/security-hardening.md exists, but is not a repository security disclosure policy.
- The tracked .github tree contains workflow and agent-instruction files, including .github/.DS_Store; no formal ownership file is present.
- Live tip commits 3631357 and 6684ba7 are GitHub-verified merge commits. Live d10152c is unsigned, and local CI commits 70b7a21, 66e9dfe, and f0f89f6 are not cryptographically verified despite 70b7a21 using the word [verified] in its subject. This is informational because signed commits are not currently required.

## 6. Findings

Severity convention: P0 = critical immediate loss/outage/security compromise; P1 = high production or governance risk; P2 = material operational/compliance risk; P3 = lower-risk hygiene/process gap.

### P1-01 — Protected branches do not require quality/deployment gates

- Confidence: High.
- Evidence: protection API lists only check-source-branch as required; live main 3631357 has a failed Deploy API to Hostinger check; repository settings show no ruleset; .github/workflows/ci-cd.yml:3-8 defines the broader pipeline.
- Impact: a PR can satisfy source-branch policy while API deployment or another quality/deployment job fails. Production branch state and deployed runtime can diverge.
- Recommendation: make the intended API/Web quality gates and deployment decision explicit. Require all merge-blocking quality checks on protected branches; treat production deployment as a separate successful gate or documented post-merge release process. Remove placeholder/continue-on-error behavior if E2E is intended as a gate.
- Acceptance criteria: protection API for both main and dev lists the approved quality contexts; a deliberately failing quality/deploy check blocks merge; the failed main API deployment is rerun or remediated with a linked incident/PR; no required check is merely a source-name validator.

### P1-02 — No mandatory human approval or code-owner review

- Confidence: High.
- Evidence: both branch protection endpoints report required_approving_review_count=0 and require_code_owner_reviews=false; no CODEOWNERS file exists; PRs #33–#45 show bot COMMENTED reviews but no human approval in the inspected range.
- Impact: production-affecting changes can merge without an independent human review, including changes to CI/CD and deployment paths.
- Recommendation: require at least one independent approval for dev and two or a code-owner approval for main, require approval after the last push, and add path-specific owners for workflows, database, and deployment code. Document the owner-only exception process if solo maintenance is intentional.
- Acceptance criteria: a non-draft PR to dev/main cannot merge without the configured approval; protection reports non-zero approvals and code-owner enforcement; stale approvals are dismissed after new pushes; a test PR demonstrates the block.

### P2-01 — Local cache and worktrees contain unreviewed divergence

- Confidence: High.
- Evidence: live dev=6684ba7 is eight commits ahead of cached dev=41bd42a; live main=3631357 is 13 commits ahead of cached main=43f9aca; active local fix/ci-use-npx has unpushed 70b7a21; temporary worktree has f0f89f6/66e9dfe; no open PR exists.
- Impact: an operator can audit or push against obsolete ancestry, lose an intended CI fix, or accidentally publish one of multiple competing one-line workflow edits.
- Recommendation: record the live SHAs as canonical, preserve all local alternatives until the owner chooses one, then submit exactly one selected change through a normal PR. Do not force-push or delete local refs as part of reconciliation.
- Acceptance criteria: every retained local-only commit has an owner and disposition; the selected commit has a live PR and required checks; both worktrees are either intentionally retained with documented purpose or safely closed after backup; local tracking refs are refreshed only with explicit approval.

### P2-02 — Branch retention and stale-ref hygiene are unmanaged

- Confidence: High.
- Evidence: nine live topic branches are unprotected; delete_branch_on_merge=false; PR #39 is closed-unmerged while its branch remains live; PR #32 is a closed draft while its duplicate tip remains live; local cache has four stale origin/* refs and 45 hidden backup refs.
- Impact: merged, superseded, and abandoned work remains selectable as a source, increasing ambiguity and accidental deployment risk. Local reports can also mistake stale refs for live branches.
- Recommendation: define a retention window and branch ownership; preserve unmerged branches until disposition is recorded; delete only merged/superseded remote branches after owner confirmation; enable automatic deletion after merge if compatible with recovery policy; prune local stale tracking refs only after an inventory snapshot.
- Acceptance criteria: every live topic branch maps to an active PR or documented retained work item; #39 and #32 have explicit keep/delete decisions; delete_branch_on_merge=true or an equivalent documented process is active; a dry-run prune shows no unexpected refs.

### P2-03 — Public repository lacks baseline security, legal, and ownership controls

- Confidence: High.
- Evidence: public repository, no license file or GitHub license metadata, no CODEOWNERS, SECURITY.md, CONTRIBUTING, issue/PR templates, or visible ruleset; Dependabot security updates and secret scanning/push protection are disabled.
- Impact: reuse/licensing is ambiguous; security disclosures and ownership escalation have no canonical path; accidental secret introduction and dependency risk are less likely to be detected automatically.
- Recommendation: add an explicit license and security disclosure policy, add CODEOWNERS and contribution/PR/issue templates, then enable the appropriate GitHub security controls after reviewing repository contents and secret-handling constraints.
- Acceptance criteria: GitHub license metadata and tracked license agree; SECURITY.md and CODEOWNERS cover deployment/CI/database paths; templates enforce risk and test information; security settings show enabled controls or a documented exception with owner and expiry.

### P2-04 — Commit-signature provenance is not enforced

- Confidence: High for configuration; medium for repository-wide coverage.
- Evidence: required_signatures.enabled=false; live merge tips 3631357 and 6684ba7 verify, but live d10152c and local CI alternatives are unsigned.
- Impact: branch history can contain unverified workflow/deployment changes, making author and provenance checks inconsistent.
- Recommendation: decide whether signed commits are required for protected branches. If yes, require verified signatures for the relevant branch and document bot/merge-commit handling; if no, document the accepted provenance model.
- Acceptance criteria: policy is documented; protection/signature settings match it; a test PR with an unverified commit is either blocked or explicitly accepted by the documented exception.

### P3-01 — No release/tag/issue operating trail

- Confidence: High.
- Evidence: no remote tags, no GitHub releases, and no non-PR issues; repository description is empty.
- Impact: production provenance, rollback labels, change ownership, and operational follow-up are harder to discover.
- Recommendation: establish a lightweight release convention (annotated semantic tags, release notes, deployment SHA), use issues for exceptions/incidents, and add repository description/topics.
- Acceptance criteria: the next production release has a tag and release note linked to its deployed SHA; failed deployment follow-up is tracked as an issue or incident; repository landing metadata states purpose and support path.

## 7. Strengths observed

- main and dev are protected, admin enforcement is enabled, force-pushes are disabled, and branch deletion is disabled at the protection layer.
- Source-branch policy is explicit in versioned workflows for both protected branches, and check-source-branch is required.
- Live dev is an ancestor of live main, and the latest main merge (3631357) records the exact dev parent (6684ba7), providing a clear release ancestry.
- CI/CD and E2E workflows run on PRs and pushes to main/dev, use least-privilege contents: read at workflow scope, and have concurrency controls.
- PR history is queryable and mostly merged through explicit PRs; the recent chain is identifiable by PR #41–#45.
- No destructive cleanup was performed; hidden backup refs, stash, unreachable objects, worktrees, and untracked audit files were preserved.

## 8. Unknowns and verification limits

- Live GitHub branch/check/protection data was queried directly; local refs were not refreshed because fetch/ref mutation was prohibited. Any local ancestry result involving origin/dev or origin/main is explicitly cache-only.
- No unmanaged clone or unregistered worktree outside git worktree list can be inferred from this checkout.
- The rulesets endpoint returned no visible rulesets for the authenticated owner; organization/enterprise controls not exposed by that endpoint may still exist.
- Review evidence was fully enumerated for the recent PR range #33–#45 but not individually replayed for all 45 historical PRs. Protection configuration is the authoritative finding for the merge gate.
- The failed API check is a point-in-time GitHub Actions result; a later rerun may have changed externally after this audit snapshot.

## 9. Safe, non-destructive cleanup plan

1. Preserve the evidence already captured: live ls-remote output, branch/PR/protection JSON, worktree list, show-ref, and this report.
2. Assign an owner and disposition to local 70b7a21, temporary f0f89f6/66e9dfe, the two worktrees, the stash, and the refs/original recovery refs. If retention is required, create a bundle or patch backup before any deletion.
3. Resolve PR #39 and #32 explicitly. Do not delete their live branches merely because the PRs are closed; confirm that no recovery or follow-up work depends on them.
4. For merged topic branches, make a branch-retention decision and only then delete the remote branch through an approved GitHub action. Keep protected main/dev.
5. Run git remote prune origin --dry-run first. Only after reviewing its exact list may an owner approve the non-destructive-to-GitHub local ref cleanup; do not run prune, reflog expiry, git gc, or force operations during this audit.
6. Leave refs/original/*, refs/codex/*, refs/stash, and unreachable objects untouched until the repository owner confirms a recovery-retention window. Re-run git fsck after any future cleanup and compare object/ref counts.
7. After governance changes, re-query branch protection, rulesets, live branch list, and check runs. Verify live SHA ancestry again rather than trusting an old cached remote ref.

## 10. Governance roadmap

### Immediate (0–24 hours)

- Triage the failed Deploy API to Hostinger check on live main; document whether production is healthy and whether a follow-up commit is required.
- Choose one canonical local CI migration edit; keep alternatives preserved until the choice is recorded.
- Make required status checks reflect actual merge safety, not only source naming.

### Near term (within one week)

- Add mandatory human/code-owner review, last-push approval, and conversation-resolution policy for protected branches.
- Add CODEOWNERS, SECURITY.md, contribution/PR/issue templates, and a license.
- Establish topic-branch ownership/expiry and enable automatic deletion after merge where safe.
- Enable or formally exception-track dependency and secret scanning controls.

### Ongoing (within 30 days)

- Adopt signed-commit provenance policy and configure protection to match it.
- Adopt annotated release tags and GitHub releases tied to deployment SHAs.
- Use issues for deployment incidents and governance exceptions; add repository description and support ownership.
- Review hidden backup/unreachable-object retention on a scheduled basis, with recovery evidence before pruning.

## Evidence command set

Local read-only commands:

~~~text
git worktree list --porcelain
git status --short --branch
git branch -a -vv --no-abbrev
git remote show origin
git ls-remote --symref origin HEAD 'refs/heads/*'
git ls-remote --tags --refs origin
git for-each-ref --format='%(refname) %(objectname) ...' refs/heads refs/remotes refs/tags refs/original refs/codex refs/stash
git rev-list --left-right --count <base>...<head>
git fsck --full --unreachable --no-reflogs --no-progress
git log --all --decorate --graph --oneline --date-order
~~~

Live GitHub read-only endpoints:

~~~text
https://api.github.com/repos/CarlitoDon/sync-erp
https://api.github.com/repos/CarlitoDon/sync-erp/branches?per_page=100
https://api.github.com/repos/CarlitoDon/sync-erp/branches/main/protection
https://api.github.com/repos/CarlitoDon/sync-erp/branches/dev/protection
https://api.github.com/repos/CarlitoDon/sync-erp/rulesets?includes_parents=true
https://api.github.com/repos/CarlitoDon/sync-erp/pulls?state=all&per_page=100
https://api.github.com/repos/CarlitoDon/sync-erp/issues?state=all&per_page=100
https://api.github.com/repos/CarlitoDon/sync-erp/releases?per_page=100
https://api.github.com/repos/CarlitoDon/sync-erp/license
https://api.github.com/repos/CarlitoDon/sync-erp/commits/3631357aabb5cbbff61924260e49bdc8257ef0c0/check-runs?per_page=100
https://api.github.com/repos/CarlitoDon/sync-erp/commits/6684ba78b2d2eb318b0d19c5c04fd82e2c3bba13/check-runs?per_page=100
~~~

Report path: docs/audits/2026-08-09-full-repository-audit/subreports/09-git-branches-governance.md.

Key findings: P1 protection requires only source naming while live main has a failed API deployment; P1 required approvals are zero; P2 local/live refs and unpushed CI alternatives diverge; P2 branch retention/security/legal controls are incomplete; P3 release/tag/issue trail is absent.

