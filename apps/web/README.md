# Web App Notes

This workspace is deployed by the `CI/CD` GitHub Actions workflow.

- Changes under `apps/web/**` trigger the `deploy_web` job on pushes to `main` and `dev`.
- The Vercel project is deployed from CI with Vercel CLI using `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID_WEB`.
- Deploy hooks remain supported by the workflow as a fallback path, but the current project is not relying on Vercel Git integration.
