# Quickstart: Company Selection

## Prerequisites

- Backend running (`npm run dev:api`)
- Database migrated (`npx prisma migrate dev`)

## Manual Testing Steps

1. **Register New User**:
   - Go to `/register`.
   - Create account.
   - Verify redirection to `/select-company`.
   - Verify "Create" and "Join" buttons appear.

2. **Create Company**:
   - Click "Create Company".
   - Enter name "Test Startup".
   - Submit.
   - Verify redirection to Dashboard.
   - Check `currentCompany` in context (React DevTools or local storage).

3. **Join Company**:
   - (As Admin) Get invite code from DB or UI for "Test Startup".
   - (As User 2) Go to `/select-company`.
   - Click "Join Company".
   - Enter code.
   - Verify success and redirection to Dashboard.

4. **Switch Company**:
   - From Dashboard, click User Menu -> "Switch Company".
   - Verify redirection to `/select-company`.
   - Select different company.
   - Verify new context on Dashboard.
