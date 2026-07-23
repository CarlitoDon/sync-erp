# 0001. Generic Multi-Tenant Pivot & Override Merge

**Date:** 2026-07-17
**Status:** Accepted

## Context

The repository historically contained tight-coupled proprietary features for an internal business known as "Santi Living". To pivot Sync ERP into a generic, standalone multi-tenant product intended for external sale, the internal Santi Living domain models, routers, and logic had to be eradicated.

The `dev` branch had been sanitized of these specific features, but standard Git merge strategies would allow additive artifacts (files uniquely present in `main`) to persist in the `main` branch. Additionally, migrating the production database away from these proprietary models cleanly using standard diffs was overly complex.

## Decision

1.  **Override Branch Merge Strategy:** We elected to use a forced tree-override merge (`git merge -s ours` + `git read-tree` or equivalent Git plumbing) from `dev` to `main`. This guaranteed that `main` became a 100% exact replica of the `dev` state, permanently deleting all Santi Living remnants.
2.  **Hard Database Migration:** We agreed that the production database (`main` environment) would undergo a destructive reset/hard migration, explicitly allowing the eradication of existing Santi Living records from the schema.
3.  **Terminology Standarization:** The primary entity using the ERP is canonically established as a **Tenant**.

## Consequences

*   **Positive:** The codebase is irreversibly freed of proprietary business logic, facilitating a multi-tenant generic product architecture.
*   **Negative:** Existing production data for Santi Living requires destruction or custom external extraction, as the application schema no longer supports reading it. Future contributors will not see the history of these models without explicit deep-history git digs.
