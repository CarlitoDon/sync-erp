# Sync ERP Go-To-Market Readiness

## Current Position

Sync ERP is ready for controlled pilot selling, not yet for unmonitored public scale. The product now has a standalone ERP core, freemium billing model, protected free-tier ads surface, media gating, dual integration API, Santi Living as an external API integrator, and standalone MCP transport for future AI ERP workflows.

## Launch Modes

### Pilot/Beta Launch

- Target: 3-10 real businesses with direct founder/operator support.
- Goal: validate onboarding, core ERP workflows, billing upgrade, and support load.
- Required: production deploy, monitored errors, manual support channel, legal baseline, and backup/export procedure.
- Acceptable: manual checkout fallback and limited AdSense monetization.

### Public Launch

- Target: self-serve acquisition from marketing/pricing pages.
- Goal: user can register, create company, onboard, use Free, upgrade, and get support without manual intervention.
- Required: payment provider production keys, webhook verification, AdSense approval, crawler access for protected free pages, legal review, and uptime monitoring.
- Not acceptable: unknown webhook state, missing `ads.txt`, missing privacy/terms, or paid upgrade without provider confirmation.

## Production Deploy Checklist

- [ ] Deploy API with `SYNC_ERP_WEB_URL`, `SYNC_ERP_API_BASE_URL`, `CORS_ALLOWED_ORIGINS`, database URL, auth/session secrets, and billing webhook secret.
- [ ] Configure Google OAuth with `SYNC_ERP_AUTH_STATE_SECRET`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and `GOOGLE_OAUTH_REDIRECT_URI=https://api.sync-erp.com/api/auth/google/callback`.
- [x] Configure Vercel web env `VITE_SYNC_ERP_API_URL` for production and preview API domains.
- [ ] Deploy Web with `VITE_SYNC_ERP_API_URL`, `VITE_GOOGLE_ADSENSE_ENABLED`, `VITE_GOOGLE_ADSENSE_CLIENT_ID`, and production AdSense slot IDs.
- [ ] Configure billing provider: `BILLING_PROVIDER=MIDTRANS`, `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION=true`.
- [ ] Register Midtrans webhook URL: `/api/billing/webhooks/midtrans`.
- [ ] Verify checkout success, pending, failed, and cancelled redirects from `/settings/billing`.
- [ ] Upload production `ads.txt` with the exact publisher ID from AdSense.
- [ ] Verify `/privacy`, `/terms`, `/robots.txt`, and `/ads.txt` are reachable over HTTPS.
- [ ] Add a stable crawler login in AdSense for protected free pages if ads are expected inside the logged-in app.
- [ ] Enable API logs, error tracking, database backup, and uptime monitoring.
- [ ] Run `rtk tsc --noEmit`, `rtk lint`, API build, web build, and targeted billing tests before release.

## DNS Checklist

- [x] Add Vercel project domains: `sync-erp.com`, `app.sync-erp.com`, and `staging.sync-erp.com`.
- [ ] Point `sync-erp.com` to Vercel with `A sync-erp.com 76.76.21.21`.
- [ ] Point `app.sync-erp.com` to Vercel with `A app.sync-erp.com 76.76.21.21`.
- [ ] Point `staging.sync-erp.com` to Vercel with `A staging.sync-erp.com 76.76.21.21`.
- [ ] Point `api.sync-erp.com` to Hostinger with `A api.sync-erp.com 46.17.173.54`.
- [ ] Point `api-staging.sync-erp.com` to Hostinger with `A api-staging.sync-erp.com 46.17.173.54`.
- [ ] Re-check DNS propagation and HTTPS health after records are updated.

## AdSense Monetization Checklist

- [ ] AdSense account is approved.
- [ ] Production domain is added and approved in AdSense.
- [ ] Site contains public value pages, not only a login wall.
- [ ] `apps/web/public/ads.txt` is replaced with the real AdSense seller line.
- [ ] `VITE_GOOGLE_ADSENSE_ENABLED=true`.
- [ ] `VITE_GOOGLE_ADSENSE_CLIENT_ID=ca-pub-...`.
- [ ] `VITE_GOOGLE_ADSENSE_DEFAULT_SLOT` and `VITE_GOOGLE_ADSENSE_FOOTER_SLOT` are set.
- [ ] Free plan user sees ad slots on protected app pages.
- [ ] Paid plan user does not see ad slots.
- [ ] AdSense crawler access is configured for login-protected pages.

## Billing Upgrade Checklist

- [ ] Free company starts with plan `free`.
- [ ] Paid plan checkout from `/settings/billing` creates a checkout session.
- [ ] Manual checkout sandbox can confirm, fail, and cancel locally or in staging.
- [ ] Midtrans checkout creates a Snap redirect URL in production-like staging.
- [ ] Midtrans webhook signature validation rejects invalid notifications.
- [ ] Successful payment updates `CompanySubscription.planKey`.
- [ ] Billing page shows payment result state after redirect.
- [ ] Billing page reflects the upgraded plan after webhook processing.
- [ ] Failed or cancelled checkout leaves the existing plan unchanged.

## Google OAuth Checklist

- [x] Google Cloud production project created: `sync-erp-prod-20260522`.
- [x] Google Auth Platform configured as external app.
- [x] OAuth publishing status set to production.
- [x] OAuth web client created for production, staging, and local callback URLs.
- [x] Google data access verification not required for current basic scopes.
- [ ] Complete Google branding verification if consent-screen branding must be shown to public users.
- [ ] Deploy API with the generated Google OAuth client secret.
- [ ] Verify `/api/auth/google/start?intent=register` redirects to Google and callback creates/links a user.

## Onboarding Sales Flow

- [ ] Visitor lands on `/` and understands Free vs paid tiers.
- [ ] Visitor clicks a pricing CTA such as `/register?plan=growth`.
- [ ] Register page preserves selected paid plan intent.
- [ ] User creates or selects company.
- [ ] If onboarding is incomplete, user finishes onboarding first.
- [ ] After onboarding, user is sent to Billing to continue the selected upgrade.
- [ ] If user selected Free, they land in the dashboard without payment.

## Legal/Policy Checklist

- [ ] `/privacy` reviewed and updated with company legal identity and support contact.
- [ ] `/terms` reviewed and updated with billing, refund, SLA, jurisdiction, and acceptable use.
- [ ] Cookie/ads consent reviewed for target jurisdictions.
- [ ] Data deletion and export process documented for support.
- [ ] API terms and abuse policy finalized before promoting public API access.

## Revenue Reality

Free tier can offset cost only after AdSense approval, real traffic, crawlable ad pages, and policy-compliant placements. Treat AdSense as a subsidy, not the core monetization engine. Primary revenue should come from paid upgrades, setup assistance, managed migration, custom integration, priority support, and future AI ERP add-ons.

## Next Commercial Tasks

- [ ] Create a short demo video for the landing page.
- [ ] Add a public changelog and roadmap page.
- [ ] Add support contact or in-app help entry.
- [ ] Add production analytics for registration, company creation, onboarding completion, and checkout start/completion.
- [ ] Recruit first pilot businesses and track friction manually.
