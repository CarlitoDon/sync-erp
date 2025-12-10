# Tasks: User Authentication Module

**Feature**: `002-user-auth`
**Status**: Ready
**Total Tasks**: 23

## Dependencies

- Phase 2 (Foundation) blocks all US phases.
- Phase 3 (US1 Register) blocks Phase 4 (Login) functionally (need user to login).
- Phase 4 (US2 Login) blocks Phase 5 (Logout).

## Phase 1: Setup

- [ ] T001 Update Prisma schema with User and Session models in packages/database/prisma/schema.prisma
- [ ] T002 Run prisma generate to update client in packages/database
- [ ] T003 Run prisma migrate to create tables in packages/database
- [ ] T004 Create shared Auth types (payloads, responses) in packages/shared/src/types/auth.ts
- [ ] T005 Create Zod validators for Auth in packages/shared/src/validators/auth.ts

## Phase 2: Foundational (Blocking)

- [ ] T006 Implement Auth utility (password hashing) in apps/api/src/services/authUtil.ts
- [ ] T007 Implement Session management service in apps/api/src/services/sessionService.ts
- [ ] T008 [P] Implement Auth middleware (session validation) in apps/api/src/middlewares/authMiddleware.ts
- [ ] T009 Update Express app to use cookieParser in apps/api/src/app.ts

## Phase 3: User Story 1 - User Registration (Priority P1)

**Goal**: Users can register and get automatically logged in.
**Test**: POST /register creates DB user, returns cookie, and redirects.

- [ ] T010 [US1] Implement register service logic in apps/api/src/services/authService.ts
- [ ] T011 [US1] Create register endpoint in apps/api/src/routes/auth.ts
- [ ] T012 [P] [US1] Create frontend Auth service (register method) in apps/web/src/services/authService.ts
- [ ] T013 [US1] Create Registration Page in apps/web/src/pages/Register.tsx
- [ ] T014 [US1] Add route for Register page in apps/web/src/App.tsx

## Phase 4: User Story 2 - User Login (Priority P1)

**Goal**: Existing users can login.
**Test**: POST /login with valid creds returns 200 + cookie.

- [ ] T015 [US2] Implement login service logic (verify password, create session) in apps/api/src/services/authService.ts
- [ ] T016 [US2] Create login endpoint in apps/api/src/routes/auth.ts
- [ ] T017 [P] [US2] Update frontend Auth service (login method) in apps/web/src/services/authService.ts
- [ ] T018 [US2] Create Login Page in apps/web/src/pages/Login.tsx
- [ ] T019 [US2] Add route for Login page in apps/web/src/App.tsx

## Phase 5: User Story 3 - User Logout (Priority P2)

**Goal**: Users can end session.
**Test**: POST /logout destroys cookie & DB session.

- [ ] T020 [US3] Implement logout logic in apps/api/src/services/authService.ts
- [ ] T021 [US3] Create logout endpoint in apps/api/src/routes/auth.ts
- [ ] T022 [P] [US3] Update frontend Auth service (logout method) in apps/web/src/services/authService.ts

## Phase 6: Polish

- [ ] T023 Add 'Me' endpoint to fetch current user context in apps/api/src/routes/auth.ts
