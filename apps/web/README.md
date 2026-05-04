# Web App Notes

This workspace is deployed by the `CI/CD` GitHub Actions workflow.

- Changes under `apps/web/**` trigger the `deploy_web` job on pushes to `main` and `dev`.
- GitHub Actions prefers Vercel deploy hooks when configured.
- If deploy hooks are unavailable or rate-limited, the workflow falls back to Vercel CLI.
