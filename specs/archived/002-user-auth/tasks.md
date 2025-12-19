# Tasks: User Authentication Module

**Feature**: `002-user-auth`
**Status**: Ready
**Total Tasks**: 23

## Dependencies

- Phase 2 (Foundation) blocks all US phases.
- Phase 3 (US1 Register) blocks Phase 4 (Login) functionally (need user to login).
- Phase 4 (US2 Login) blocks Phase 5 (Logout).

## Phase 1: Setup

- [x] T001 Update Prisma schema with User and Session models in packages/database/prisma/schema.prisma
- [x] T002 Run prisma generate to update client in packages/database
- [x] T003 Run prisma migrate to create tables in packages/database
- [x] T004 Create shared Auth types (payloads, responses) in packages/shared/src/types/auth.ts
- [x] T005 Create Zod validators for Auth in packages/shared/src/validators/auth.ts

## Phase 2: Foundational (Blocking)

- [x] T006 Implement Auth utility (password hashing) in apps/api/src/services/authUtil.ts
- [x] T007 Implement Session management service in apps/api/src/services/sessionService.ts
- [x] T008 [P] Implement Auth middleware (session validation) in apps/api/src/middlewares/authMiddleware.ts
- [x] T009 Update Express app to use cookieParser in apps/api/src/app.ts

## Phase 3: User Story 1 - User Registration (Priority P1)

**Goal**: Users can register and get automatically logged in.
**Test**: POST /register creates DB user, returns cookie, and redirects.

- [x] T010 [US1] Implement register service logic in apps/api/src/services/authService.ts
- [x] T011 [US1] Create register endpoint in apps/api/src/routes/auth.ts
- [x] T012 [P] [US1] Create frontend Auth service (register method) in apps/web/src/services/authService.ts
- [x] T013 [US1] Create Registration Page in apps/web/src/pages/Register.tsx
- [x] T014 [US1] Add route for Register page in apps/web/src/App.tsx

## Phase 4: User Story 2 - User Login (Priority P1)

**Goal**: Existing users can login.
**Test**: POST /login with valid creds returns 200 + cookie.

- [x] T015 [US2] Implement login service logic (verify password, create session) in apps/api/src/services/authService.ts
- [x] T016 [US2] Create login endpoint in apps/api/src/routes/auth.ts
- [x] T017 [P] [US2] Update frontend Auth service (login method) in apps/web/src/services/authService.ts
- [x] T018 [US2] Create Login Page in apps/web/src/pages/Login.tsx
- [x] T019 [US2] Add route for Login page in apps/web/src/App.tsx

## Phase 5: User Story 3 - User Logout (Priority P2)

**Goal**: Users can end session.
**Test**: POST /logout destroys cookie & DB session.

- [x] T020 [US3] Implement logout logic in apps/api/src/services/authService.ts
- [x] T021 [US3] Create logout endpoint in apps/api/src/routes/auth.ts
- [x] T022 [P] [US3] Update frontend Auth service (logout method) in apps/web/src/services/authService.ts

## Phase 6: Polish

- [x] T023 Add 'Me' endpoint to fetch current user context in apps/api/src/routes/auth.ts

## Phase 7: Refactoring (DRY Data Fetching)

- [x] T024 Create useCompanyData hook in apps/web/src/hooks/useCompanyData.ts
- [x] T025 Refactor Suppliers page to use useCompanyData
- [x] T026 Refactor Products page to use useCompanyData
- [x] T027 Refactor Inventory page to use useCompanyData
- [x] T028 Refactor SalesOrders page to use useCompanyData
- [x] T029 Refactor PurchaseOrders page to use useCompanyData
- [x] T030 Refactor Invoices page to use useCompanyData
- [x] T031 Refactor Finance page to use useCompanyData
