# Quickstart: User Authentication

## Prerequisites

- Database running (`npm run db:up`)
- Environment variables set (`DATABASE_URL`, `SESSION_SECRET`)

## Setup

1. **Apply Migrations**:

   ```bash
   npx prisma migrate dev --name add_auth_models
   ```

2. **Start Backend**:

   ```bash
   cd apps/api && npm run dev
   ```

3. **Start Frontend**:
   ```bash
   cd apps/web && npm run dev
   ```

## Usage

### Register

POST `/api/auth/register`

```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

### Login

POST `/api/auth/login`

```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

### Protected Routes

Ensure browser sends cookies. All API calls to protected routes will fail with 401 if no valid session cookie exists.
