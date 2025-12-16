# Quickstart: Apple-Style Backend Core Refactor

**Feature**: 020-apple-backend-refactor
**Date**: 2025-12-16

## Prerequisites

- Node.js 20.x
- PostgreSQL running (local or Docker)
- Turbo monorepo setup complete

## Quick Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Database Migration

```bash
cd packages/database
npx prisma migrate dev --name add_business_shape
npx prisma generate
```

### 3. Build Shared Package

```bash
cd packages/shared
npm run build
```

### 4. Start Development Server

```bash
npm run dev
```

## Key Commands

| Command             | Description                        |
| ------------------- | ---------------------------------- |
| `npx tsc --noEmit`  | TypeScript check (source of truth) |
| `npm run test`      | Run all tests                      |
| `npm run build`     | Full production build              |
| `npx prisma studio` | Open Prisma database browser       |

## Testing the Refactor

### Test 1: Verify PENDING Shape Blocks Operations

```bash
# Create a new company (will have PENDING shape by default)
# Try to adjust stock - should fail with 400 error
curl -X POST http://localhost:3000/api/inventory/adjust \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"productId": "...", "quantity": 10}'

# Expected: 400 Bad Request
# {"error": "Operations blocked until business shape is selected"}
```

### Test 2: Select Business Shape

```bash
curl -X POST http://localhost:3000/api/company/select-shape \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"shape": "RETAIL"}'

# Expected: 200 OK
# {"success": true, "shape": "RETAIL", "configSeeded": true, "coaSeeded": true}
```

### Test 3: Verify SERVICE Shape Blocks Stock Adjustment

```bash
# For a company with SERVICE shape:
curl -X POST http://localhost:3000/api/inventory/adjust \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"productId": "...", "quantity": 10}'

# Expected: 400 Bad Request
# {"error": "Stock tracking is disabled for Service companies"}
```

### Test 4: Verify Shape Immutability

```bash
# Try to change shape after it's been set:
curl -X POST http://localhost:3000/api/company/select-shape \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"shape": "MANUFACTURING"}'

# Expected: 400 Bad Request
# {"error": "Business shape cannot be changed after initial selection"}
```

## File Structure After Refactor

```
apps/api/src/modules/
├── company/
│   ├── company.controller.ts  # Added POST /select-shape
│   ├── company.service.ts     # Added selectShape method
│   └── company.policy.ts      # NEW: Shape transition rules
├── inventory/
│   ├── inventory.constants.ts # NEW: Movement types
│   ├── inventory.policy.ts    # NEW: Shape-based constraints
│   ├── inventory.service.ts   # Modified: Policy checks
│   ├── rules/
│   │   └── stockRule.ts       # NEW: Pure business logic
│   └── inventory.repository.ts
└── sales/
    ├── sales.policy.ts        # NEW: Shape-based constraints
    └── sales.service.ts       # Modified: Policy checks
```

## Troubleshooting

### Migration Fails

```bash
# Reset database (development only!)
npx prisma migrate reset

# Re-run migration
npx prisma migrate dev
```

### TypeScript Errors After Migration

```bash
# Regenerate Prisma client
cd packages/database
npx prisma generate

# Rebuild shared package
cd packages/shared
npm run build

# Verify
npx tsc --noEmit
```

### Policy Not Enforcing

1. Check that `authMiddleware` loads `company.businessShape` into `req.company`
2. Check that service methods call `Policy.ensureCan*()` BEFORE repository calls
3. Check that `DomainError` is properly caught by error middleware

## Next Steps

After completing this refactor:

1. Run `/speckit-tasks` to generate implementation tasks
2. Execute tasks in order (schema → policy → service → endpoint)
3. Verify with `npm run test` after each phase
4. Create PR for review
