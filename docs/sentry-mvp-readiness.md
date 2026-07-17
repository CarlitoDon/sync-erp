# Sentry MVP Readiness

Status: code-integrated, live project verification deferred.

This repository now includes optional Sentry wiring for the API and web app without requiring a production domain, deployed environment, or real Sentry DSN for the local/no-deploy MVP.

## What is implemented in code

- API package dependencies: `@sentry/node` and `@sentry/profiling-node`.
- Web package dependency: `@sentry/react`.
- API initialization in `apps/api/src/instrument.ts`.
- API error capture middleware in `apps/api/src/middlewares/sentry.ts`.
- API correlation ID and request context attached to captured server-side errors.
- Web initialization in `apps/web/src/lib/sentry.ts`.
- Web error boundary in `apps/web/src/components/AppErrorBoundary.tsx`.
- Optional test route in `apps/api/src/routes/test-sentry.router.ts`.

## Local/no-domain MVP behavior

Sentry is disabled unless a DSN is provided and Sentry is not explicitly disabled:

- API: set `SENTRY_DSN` and leave `SENTRY_ENABLED` unset or set it to `true`.
- Web: set `VITE_SENTRY_DSN` and leave `VITE_SENTRY_ENABLED` unset or set it to `true`.

If these DSN variables are empty, local development and demos continue without error tracking and without build-time failure.

## Test route safety

The API test route is not mounted by default.

To enable it for development or staging:

```env
SENTRY_TEST_ROUTE_ENABLED=true
```

The route is then available at:

```text
GET /internal/observability/test-error
```

In production, the route also requires this additional explicit opt-in:

```env
SENTRY_ALLOW_PRODUCTION_TEST_ROUTE=true
```

Leave both flags `false` for normal MVP demos.

## Secrets policy

Do not commit real DSNs, auth tokens, project IDs, or Sentry API keys. The committed env examples intentionally leave DSN values blank.

## Deferred production-only steps

These steps require a real Sentry account/project and are intentionally deferred until deploy/domain work resumes:

- Create API and web Sentry projects.
- Add real DSN values to the runtime secret manager.
- Configure Sentry alert rules for error spikes, API availability, and auth anomalies.
- Verify a sample event appears in Sentry within the expected time window.
- Confirm release names/source maps in the deployed environment.
